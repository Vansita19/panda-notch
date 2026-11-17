import AppKit
import WebKit
import Carbon
import ServiceManagement
import UniformTypeIdentifiers

final class PandaPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
final class ClearWebView: WKWebView {
    override var isOpaque: Bool { false }
    override var needsPanelToBecomeKey: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate, NSDraggingSource {
    var panel: PandaPanel!
    private var workspace: NSWindow?
    private var workspaceFrame: NSRect?
    private var workspaceWindowedFrame: NSRect?
    private var pendingDockExpansion: Bool?
    private var workspaceTransitioning = false
    private var workspaceOnReady = ProcessInfo.processInfo.arguments.contains("--workspace")
    var web: ClearWebView!
    var statusItem: NSStatusItem!
    var ticker: Foundation.Timer?
    var hotKey: EventHotKeyRef?
    var eventHandler: EventHandlerRef?
    let textCapture=TextCapture()
    lazy var campaignBridge = CampaignBridge(publish: { [weak self] type, payload in self?.send(type, payload) })
    lazy var music:NowPlaying = {let reader=NowPlaying();reader.publish = { [weak self] type,payload in self?.send(type,payload) };return reader}()
    var menuBounds: CGRect = .zero
    var clipperBounds: CGRect = .zero
    var outsideLocalMonitor: Any?
    var clickMonitor: Any?
    var pinDragMonitor: Any?
    var pinMouseDown: NSEvent?
    var pendingPinURL: URL?
    var expanded = false
    var ready = false
    var sleeping = false
    var quitting = false
    var tickCount = 0
    var activeSound: NSSound?
    var lastSoundAt = Date.distantPast
    var diskWarning: String?
    var shortcutError: String?
    var currentState: [String: Any]?
    var campaignStateSaved = false
    lazy var calendarReader: CalendarReader = {
        let reader = CalendarReader()
        reader.selectedIDs = { [weak self] in (self?.currentState?["calendar"] as? [String:Any])?["selectedIds"] as? [String] ?? [] }
        reader.isConnected = { [weak self] in (self?.currentState?["calendar"] as? [String:Any])?["mode"] as? String == "connected" }
        reader.tasks = { [weak self] in self?.currentState?["tasks"] as? [[String:Any]] ?? [] }
        reader.publish = { [weak self] type, payload in self?.send(type,payload) }
        return reader
    }()
    let fm = FileManager.default
    lazy var folder: URL = {
        if let p = ProcessInfo.processInfo.environment["PANDA_DATA_DIR"] { return URL(fileURLWithPath:p) }
        return fm.urls(for:.applicationSupportDirectory,in:.userDomainMask).first!.appendingPathComponent("Panda", isDirectory:true)
    }()
    lazy var stateURL = folder.appendingPathComponent("state.json")
    var selectedScreen: NSScreen { NSScreen.screens.first(where:{$0.safeAreaInsets.top > 0}) ?? NSScreen.main ?? NSScreen.screens[0] }
    // Keep signed host resources immutable across ordinary UI updates, preserving TCC identity.
    lazy var webRoot: URL = {
        let bundled = Bundle.main.resourceURL!.appendingPathComponent("Web",isDirectory:true)
        let installed = folder.appendingPathComponent("Web",isDirectory:true)
        if !fm.fileExists(atPath:installed.appendingPathComponent("index.html").path) {
            try? fm.copyItem(at:bundled,to:installed)
        }
        return fm.fileExists(atPath:installed.appendingPathComponent("index.html").path) ? installed : bundled
    }()
    func configuration() -> [String:Any] {
        let screen=selectedScreen
        let width:CGFloat
        if let l=screen.auxiliaryTopLeftArea,let r=screen.auxiliaryTopRightArea { width=max(0,r.minX-l.maxX) } else { width=180 }
        var c:[String:Any] = ["safeTop":screen.safeAreaInsets.top,"notchWidth":width,"availableHeight":screen.frame.height-30,"launchAtLogin":SMAppService.mainApp.status == .enabled,"workspaceSupported":true]
        if let w=diskWarning { c["storageWarning"]=w }
        if let w=shortcutError { c["shortcutError"]=w }
        return c
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        if NSRunningApplication.runningApplications(withBundleIdentifier:Bundle.main.bundleIdentifier!).count>1 { NSApp.terminate(nil); return }
        NSApp.setActivationPolicy(.accessory)
        do { try fm.createDirectory(at:folder,withIntermediateDirectories:true) } catch { diskWarning="Panda could not create its save folder. Export your work before quitting." }
        if fm.fileExists(atPath:stateURL.path) {
            do { let data=try Data(contentsOf:stateURL);try data.write(to:folder.appendingPathComponent("startup-backup.json"),options:.atomic); let obj=try JSONSerialization.jsonObject(with:data); guard let value=obj as? [String:Any],value["version"] as? Int == 1 else { throw CocoaError(.fileReadCorruptFile) }; currentState=value }
            catch { let backup=folder.appendingPathComponent("unreadable-\(Int(Date().timeIntervalSince1970)).json"); try? fm.copyItem(at:stateURL,to:backup);diskWarning="Panda preserved an unreadable save in its data folder. This session starts fresh." }
        }
        panel=PandaPanel(contentRect:NSRect(x:0,y:0,width:468,height:100),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
        panel.title="Panda";panel.isOpaque=false;panel.backgroundColor = .clear;panel.hasShadow=false;panel.hidesOnDeactivate=false;panel.isFloatingPanel=true;panel.isReleasedWhenClosed=false
        panel.level=NSWindow.Level(rawValue:NSWindow.Level.statusBar.rawValue+1)
        panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.stationary]
        panel.delegate=self;panel.acceptsMouseMovedEvents=true
        let c=WKWebViewConfiguration();c.websiteDataStore = .nonPersistent()
        c.userContentController.add(self,name:"panda")
        let saved=Self.json(currentState as Any? ?? NSNull()),config=Self.json(configuration())
        c.userContentController.addUserScript(WKUserScript(source:"window.__PANDA_SAVED__=\(saved);window.__PANDA_CONFIG__=\(config);",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        web=ClearWebView(frame:panel.contentView!.bounds,configuration:c)
        web.autoresizingMask=[.width,.height];web.navigationDelegate=self;web.underPageBackgroundColor = .clear
        web.setValue(false,forKey:"drawsBackground")
        panel.contentView=web
        web.loadFileURL(webRoot.appendingPathComponent("index.html"),allowingReadAccessTo:webRoot)
        resize(width:428,height:selectedScreen.safeAreaInsets.top > 0 ? selectedScreen.safeAreaInsets.top : 28)
        if !workspaceOnReady { panel.orderFrontRegardless() }
        createMenu();let main=NSMenu();let appItem=NSMenuItem();let appMenu=NSMenu();let quitItem=NSMenuItem(title:"Quit Panda",action:#selector(quit),keyEquivalent:"q");quitItem.target=self;appMenu.addItem(quitItem);appItem.submenu=appMenu;main.addItem(appItem);// WebKit routes Command-A/C/V/Z through the standard responder menu.
        let editItem=NSMenuItem();let editMenu=NSMenu(title:"Edit");editItem.submenu=editMenu
        for (title,action,key) in [("Undo","undo:","z"),("Redo","redo:","Z"),("Cut","cut:","x"),("Copy","copy:","c"),("Paste","paste:","v"),("Select All","selectAll:","a")] {
            let item=NSMenuItem(title:title,action:Selector(action),keyEquivalent:key.lowercased())
            item.keyEquivalentModifierMask=key == "Z" ? [.command,.shift] : [.command]
            editMenu.addItem(item)
        }
        main.addItem(editItem)
        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)
        NSApp.mainMenu = main
        NSApp.windowsMenu = windowMenu
        registerShortcut()
        ticker=Foundation.Timer.scheduledTimer(withTimeInterval:1,repeats:true){[weak self] _ in guard let self,self.ready,!self.sleeping else{return};self.send("tick",Date().timeIntervalSince1970*1000);self.tickCount += 1;if self.tickCount % 15 == 0 {self.send("checkpoint")};if self.tickCount % 5 == 0 {self.music.refresh();self.campaignBridge.poll()};if self.tickCount % 60 == 0 && self.calendarReader.isConnected() {self.calendarReader.refresh()}}
        ticker?.tolerance=0.1
        NotificationCenter.default.addObserver(self,selector:#selector(screenChanged),name:NSApplication.didChangeScreenParametersNotification,object:nil)
        let center=NSWorkspace.shared.notificationCenter
        center.addObserver(self,selector:#selector(willSleep),name:NSWorkspace.willSleepNotification,object:nil)
        center.addObserver(self,selector:#selector(didWake),name:NSWorkspace.didWakeNotification,object:nil)
        DistributedNotificationCenter.default().addObserver(self,selector:#selector(willSleep),name:NSNotification.Name("com.apple.screenIsLocked"),object:nil)
        DistributedNotificationCenter.default().addObserver(self,selector:#selector(didWake),name:NSNotification.Name("com.apple.screenIsUnlocked"),object:nil)
        pinDragMonitor=NSEvent.addLocalMonitorForEvents(matching:[.leftMouseDown,.leftMouseDragged,.leftMouseUp]){[weak self] event in
            guard let self, event.window === (self.workspace ?? self.panel) else { return event }
            if event.type == .leftMouseDown {self.pinMouseDown=event;self.pendingPinURL=nil}
            if event.type == .leftMouseUp {self.pinMouseDown=nil;self.pendingPinURL=nil}
            if event.type == .leftMouseDragged,let url=self.pendingPinURL,let down=self.pinMouseDown {
                guard hypot(event.locationInWindow.x-down.locationInWindow.x,event.locationInWindow.y-down.locationInWindow.y)>4 else{return event}
                self.pendingPinURL=nil
                let item=NSDraggingItem(pasteboardWriter:url as NSURL)
                let point=self.web.convert(event.locationInWindow,from:nil)
                let icon=NSWorkspace.shared.icon(forFile:url.path);icon.size=NSSize(width:36,height:36)
                item.setDraggingFrame(NSRect(x:point.x-18,y:point.y-18,width:36,height:36),contents:icon)
                self.web.beginDraggingSession(with:[item],event:down,source:self)
                return nil
            }
            return event
        }
        clickMonitor=NSEvent.addGlobalMonitorForEvents(matching:[.leftMouseDown,.rightMouseDown,.otherMouseDown]){[weak self] _ in guard let self else{return};if !self.routeMenuClick(){self.dismissOutsideClick()}}
        outsideLocalMonitor=NSEvent.addLocalMonitorForEvents(matching:[.leftMouseDown,.rightMouseDown,.otherMouseDown]){[weak self] event in guard let self else{return event};if self.routeMenuClick(){return nil};self.dismissOutsideClick();return event}
    }
    func routeMenuClick()->Bool {
        guard workspace == nil, panel.isVisible else { return false }
        let mouse=NSEvent.mouseLocation
        let point=CGPoint(x:mouse.x-panel.frame.minX,y:panel.frame.maxY-mouse.y)
        if clipperBounds.contains(point){captureText();return true}
        guard menuBounds.contains(point) else{return false}
        send("toggleMenu");return true
    }
    func dismissOutsideClick() {
        guard workspace == nil, expanded, !panel.frame.contains(NSEvent.mouseLocation) else { return }
        send("close")
    }
    func windowDidResignKey(_ notification: Notification) {
        if workspace == nil, notification.object as? NSWindow === panel, expanded { send("close") }
    }
    func applicationDidResignActive(_ notification: Notification) {
        if workspace == nil, expanded { send("close") }
    }

    @objc func openWorkspace() {
        if let workspace {
            focusWindow(workspace)
            return
        }
        guard ready else {
            workspaceOnReady = true
            return
        }

        let screen = panel.screen ?? selectedScreen
        let visible = screen.visibleFrame
        let width = min(900, visible.width - 32)
        let height = min(680, visible.height - 48)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: width, height: height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        window.title = "Panda"
        window.backgroundColor = NSColor(white: 0.04, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.contentMinSize = NSSize(width: min(420, width), height: min(320, height))
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.isReleasedWhenClosed = false
        window.delegate = self
        let size = window.frame.size
        let centered = NSRect(
            x: visible.midX - size.width / 2,
            y: visible.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
        let previous = workspaceFrame.flatMap { visible.contains($0) ? $0 : nil }
        window.setFrame(previous ?? centered, display: false)

        // Move the existing view so drafts, scroll positions and the timer stay live.
        workspace = window
        expanded = false
        panel.orderOut(nil)
        panel.contentView = nil
        window.contentView = web
        NSApp.setActivationPolicy(.regular)
        send("workspace", ["active": true])
        focusWindow(window)
    }

    private func dockWorkspace(expand: Bool) {
        guard let workspace, pendingDockExpansion == nil else { return }
        if workspaceTransitioning || workspace.styleMask.contains(.fullScreen) {
            pendingDockExpansion = expand
            if !workspaceTransitioning { workspace.toggleFullScreen(nil) }
            return
        }
        finishDocking(workspace, expand: expand)
    }

    private func finishDocking(_ window: NSWindow, expand: Bool) {
        workspaceFrame = workspaceWindowedFrame ?? window.frame
        workspaceWindowedFrame = nil
        pendingDockExpansion = nil
        workspaceTransitioning = false
        window.orderOut(nil)
        window.delegate = nil
        window.contentView = nil
        panel.contentView = web
        window.close()
        workspace = nil

        menuBounds = .zero
        expanded = false
        NSApp.setActivationPolicy(.accessory)
        send("workspace", ["active": false, "expand": expand])
        panel.orderFrontRegardless()
        if expand { focusPanel() }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard sender === workspace else { return true }
        // Let AppKit finish dismissing the standard window before moving its view.
        DispatchQueue.main.async { [weak self] in self?.dockWorkspace(expand: false) }
        return false
    }

    func windowWillEnterFullScreen(_ notification: Notification) {
        guard let window = notification.object as? NSWindow, window === workspace else { return }
        workspaceWindowedFrame = window.frame
        workspaceTransitioning = true
    }
    func windowDidEnterFullScreen(_ notification: Notification) {
        guard notification.object as? NSWindow === workspace else { return }
        workspaceTransitioning = false
        if pendingDockExpansion != nil { workspace?.toggleFullScreen(nil) }
    }
    func windowWillExitFullScreen(_ notification: Notification) {
        if notification.object as? NSWindow === workspace { workspaceTransitioning = true }
    }
    func windowDidExitFullScreen(_ notification: Notification) {
        guard let window = notification.object as? NSWindow, window === workspace else { return }
        workspaceTransitioning = false
        if let expand = pendingDockExpansion { finishDocking(window, expand: expand) }
        workspaceWindowedFrame = nil
    }
    func windowDidFailToEnterFullScreen(_ window: NSWindow) {
        guard window === workspace else { return }
        workspaceTransitioning = false
        if let expand = pendingDockExpansion { finishDocking(window, expand: expand) }
        workspaceWindowedFrame = nil
    }
    func windowDidFailToExitFullScreen(_ window: NSWindow) {
        guard window === workspace else { return }
        workspaceTransitioning = false
        pendingDockExpansion = nil
        send("pinMessage", "Exit full screen before moving Panda back to the notch.")
    }

    @objc func captureText() {
        textCapture.capture(hide: {
            if let workspace { workspace.orderOut(nil) }
            else { send("close"); panel.orderOut(nil) }
        }) { [weak self] message in
            guard let self else { return }
            if let workspace = self.workspace { self.focusWindow(workspace) }
            else { self.panel.orderFrontRegardless(); self.send("open") }
            self.send("pinMessage", message)
        }
    }
    static func json(_ x:Any)->String { guard JSONSerialization.isValidJSONObject(x) || x is NSNull,let data=try? JSONSerialization.data(withJSONObject:x,options:[.fragmentsAllowed,.sortedKeys]),let value=String(data:data,encoding:.utf8) else{return "null"};return value }
    func send(_ type:String,_ payload:Any=NSNull()) { guard web != nil else{return};let data=Self.json([type,payload]);web.evaluateJavaScript("window.pandaNative?.(...\(data))",completionHandler:nil) }
    func resize(width:Double,height:Double){let screen=selectedScreen;let w=min(max(width,240),screen.frame.width-16),h=min(max(height,selectedScreen.safeAreaInsets.top > 0 ? selectedScreen.safeAreaInsets.top : 28),screen.frame.height-15);let rect=NSRect(x:screen.frame.midX-w/2,y:screen.frame.maxY-h,width:w,height:h);if abs(panel.frame.width-w)>0.5 || abs(panel.frame.height-h)>0.5 || abs(panel.frame.minX-rect.minX)>0.5 || abs(panel.frame.minY-rect.minY)>0.5 {panel.setFrame(rect,display:true)} }
    @objc func screenChanged(){resize(width:panel.frame.width,height:panel.frame.height);send("config",configuration())}
    @objc func willSleep(){send("sleep");sleeping=true;panel.orderOut(nil)}
    @objc func didWake(){
        sleeping=false;send("wake")
        if ready { campaignBridge.poll(force:true) }
        if calendarReader.isConnected() { calendarReader.refresh() }
        send("tick", Date().timeIntervalSince1970 * 1000)
        screenChanged()
        if workspace == nil { panel.orderFrontRegardless() }
    }
    private func focusWindow(_ window: NSWindow) {
        if window.isMiniaturized { window.deminiaturize(nil) }
        if !NSApp.isActive { NSApp.activate(ignoringOtherApps: true) }
        if window === panel { window.makeKey() }
        else { window.makeKeyAndOrderFront(nil) }
        // Keep an existing WebKit field responder when restoring focus.
        if let responder=window.firstResponder as? NSView, responder === web || responder.isDescendant(of:web) { return }
        window.makeFirstResponder(web)
    }
    func focusPanel() { focusWindow(workspace ?? panel) }
    @objc func openPanel() {
        if workspace == nil { panel.orderFrontRegardless() }
        focusPanel()
        if workspace == nil { send("open") }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if ready { openPanel() }
        return false
    }
    @objc func quickAdd(){if workspace == nil { panel.orderFrontRegardless() };focusPanel();send("quickAdd")}
    @objc func previewBanner(){if workspace == nil { panel.orderFrontRegardless() };send("preview")}
    @objc func toggleQuiet(){send("quiet")}
    @objc func hidePanel(){
        if let workspace { workspace.orderOut(nil) }
        else { send("close"); panel.orderOut(nil) }
    }
    @objc func showData(){NSWorkspace.shared.open(folder)}
    @objc func quit(){NSApp.terminate(nil)}
    func createMenu(){
        statusItem=NSStatusBar.system.statusItem(withLength:NSStatusItem.variableLength)
        statusItem.button?.image=NSImage(systemSymbolName:"pawprint.fill",accessibilityDescription:"Panda")
        statusItem.button?.toolTip="Panda · your little corner of calm"
        let menu=NSMenu()
        for (title,action,key) in [("Open Panda",#selector(openPanel),""),("Open Panda Window",#selector(openWorkspace),""),("Quick add a task",#selector(quickAdd),"n"),("Copy text from screen…",#selector(captureText),""),("Say hello · preview panda",#selector(previewBanner),""),("Toggle quiet mode",#selector(toggleQuiet),""),("Hide Panda",#selector(hidePanel),""),("Open data folder",#selector(showData),""),("Quit Panda",#selector(quit),"q")] {let item=NSMenuItem(title:title,action:action,keyEquivalent:key);item.target=self;menu.addItem(item)}
        statusItem.menu=menu
    }
    func registerShortcut(){var spec=EventTypeSpec(eventClass:OSType(kEventClassKeyboard),eventKind:UInt32(kEventHotKeyPressed));InstallEventHandler(GetApplicationEventTarget(),{_,_,ptr in guard let ptr else{return noErr};let owner=Unmanaged<AppDelegate>.fromOpaque(ptr).takeUnretainedValue();DispatchQueue.main.async{owner.quickAdd()};return noErr},1,&spec,Unmanaged.passUnretained(self).toOpaque(),&eventHandler)
        let result=RegisterEventHotKey(UInt32(kVK_Space),UInt32(controlKey|optionKey),EventHotKeyID(signature:0x50414E44,id:1),GetApplicationEventTarget(),0,&hotKey)
        if result != noErr {shortcutError="Control–Option–Space is unavailable. Use the Panda menu to capture tasks."}
    }
    func userContentController(_ userContentController: WKUserContentController,didReceive message:WKScriptMessage){
        guard message.frameInfo.isMainFrame,let url=message.frameInfo.request.url,url.isFileURL,url.standardizedFileURL.path.hasPrefix(webRoot.standardizedFileURL.path+"/"),let body=message.body as? [String:Any],let type=body["type"] as? String else{return}
        switch type {
        case "ready":
            ready = true
            send("config", configuration())
            if workspaceOnReady {
                workspaceOnReady = false
                openWorkspace()
            } else if workspace != nil {
                send("workspace", ["active": true])
            }
            campaignBridge.poll(force: true)
            music.configure((currentState?["settings"] as? [String:Any])?["musicEnabled"] as? Bool ?? false)
            if calendarReader.isConnected() { calendarReader.connect() } else { calendarReader.refresh() }
        case "campaignProgress":if campaignStateSaved,let progress=body["progress"] as? [String:Any]{campaignBridge.exportProgress(progress)}
        case "addPinFiles":addPinFiles()
        case "preparePinDrag":if NSEvent.pressedMouseButtons & 1 != 0,let id=body["id"] as? String{pendingPinURL=pinFile(id)}
        case "openPin":if let id=body["id"] as? String,let p=pinRecord(id),p["kind"] as? String == "link",let text=p["url"] as? String,let url=URL(string:text),(["http","https"].contains(url.scheme?.lowercased() ?? "") || (url.isFileURL && (url.host == nil || url.host == "" || url.host == "localhost"))){NSWorkspace.shared.open(url)}
        case "copyPin":if let id=body["id"] as? String{copyPin(id)}
        case "clipperBounds":if let x=body["x"] as? Double,let y=body["y"] as? Double,let w=body["width"] as? Double,let h=body["height"] as? Double {clipperBounds=CGRect(x:x,y:y,width:w,height:h)}
        case "menuBounds":if let x=body["x"] as? Double,let y=body["y"] as? Double,let w=body["width"] as? Double,let h=body["height"] as? Double {menuBounds=CGRect(x:x,y:y,width:w,height:h)}
        case "captureText":captureText()
        case "openWorkspace":openWorkspace()
        case "dockWorkspace":dockWorkspace(expand: true)
        case "calendarConnect":calendarReader.connect()
        case "calendarRefresh":calendarReader.refresh()
        case "calendarWrite":calendarReader.write(body)
        case "musicEnabled":music.configure(body["enabled"] as? Bool ?? false)
        case "openIdeaLink":
            if let text = body["url"] as? String, text.utf8.count <= 2_000,
               let parts = URLComponents(string: text),
               let scheme = parts.scheme?.lowercased(), ["https", "http"].contains(scheme),
               let name = parts.host, !name.isEmpty, parts.user == nil, parts.password == nil,
               let url = parts.url {
                NSWorkspace.shared.open(url)
            }
        case "openSpotify":if let app=NSRunningApplication.runningApplications(withBundleIdentifier:"com.brave.Browser").first {app.activate(options:[])}
        case "openNotionCalendar":NSWorkspace.shared.open(URL(string:"https://calendar.notion.so")!)
        case "openCalendarApp":NSWorkspace.shared.open(URL(fileURLWithPath:"/System/Applications/Calendar.app"))
        case "resize":if workspace == nil,let w=body["width"] as? Double,let h=body["height"] as? Double,w.isFinite,h.isFinite{expanded=body["open"] as? Bool ?? false;resize(width:w,height:h)}
        case "focus":focusPanel()
        case "collapse":if workspace == nil { expanded=false;panel.resignKey() }
        case "save":if let state=body["state"] as? [String:Any]{save(state)}
        case "sound":playCompanionSound(body["kind"] as? String ?? "timer")
        case "export":if let state=body["state"] as? [String:Any]{exportState(state)}
        case "import":importState()
        case "login":do {if body["enabled"] as? Bool == true{try SMAppService.mainApp.register()}else{try SMAppService.mainApp.unregister()};send("config",configuration());if SMAppService.mainApp.status == .requiresApproval{SMAppService.openSystemSettingsLoginItems()}}catch{send("error","Could not change launch at login. Open Panda from this app file for now.");send("config",configuration())}
        default:break
        }
    }
    func playCompanionSound(_ kind:String){
        guard ["tap","tap2","reminder","timer","select"].contains(kind),kind == "timer" || Date().timeIntervalSince(lastSoundAt)>0.16 else{return}
        let settings=currentState?["settings"] as? [String:Any]
        if kind == "timer" {guard settings?["sound"] as? Bool == true else{return}}
        else {guard settings?["mascotSounds"] as? Bool != false else{return};if kind == "reminder" && settings?["quiet"] as? Bool == true{return}}
        let url=webRoot.appendingPathComponent("audio").appendingPathComponent(kind+".wav")
        guard let sound=NSSound(contentsOf:url,byReference:true) else{return}
        lastSoundAt=Date();activeSound?.stop();activeSound=sound;sound.volume=kind == "select" ? 1 : (["timer","reminder"].contains(kind) ? 0.85 : 0.45);sound.play()
    }
    func save(_ state:[String:Any]){
        campaignStateSaved=false
        guard state["version"] as? Int == 1, state["tasks"] is [Any],JSONSerialization.isValidJSONObject(state) else{return}
        do{let data=try JSONSerialization.data(withJSONObject:state,options:[.sortedKeys]);guard data.count<5_000_000 else{throw CocoaError(.fileWriteOutOfSpace)}
            // Keep a previous valid version before atomically replacing the current state.
            if let previous=currentState,let old=try? JSONSerialization.data(withJSONObject:previous,options:[.sortedKeys]){try old.write(to:folder.appendingPathComponent("previous-state.json"),options:.atomic)}
            let previousCalendar = Self.json(currentState?["calendar"] ?? NSNull())
            try data.write(to:stateURL,options:.atomic);currentState=state;campaignStateSaved=true;send("saved")
            if previousCalendar != Self.json(state["calendar"] ?? NSNull()) {calendarReader.refresh()}
        }catch{send("error","Panda couldn’t save to disk. Export a backup before quitting.")}
    }
    func exportState(_ state:[String:Any]){let dialog=NSSavePanel();dialog.nameFieldStringValue="Panda-backup.json";dialog.allowedContentTypes=[.json];dialog.canCreateDirectories=true;NSApp.activate(ignoringOtherApps:true);dialog.begin{[weak self] result in guard result == .OK,let url=dialog.url,let self else{return};do{try JSONSerialization.data(withJSONObject:state,options:[.prettyPrinted,.sortedKeys]).write(to:url,options:.atomic);self.send("exported")}catch{self.send("error","Could not export this backup. Please choose another location.")}}}
    func pinRecord(_ id:String)->[String:Any]? { (currentState?["pins"] as? [[String:Any]])?.first{$0["id"] as? String == id} }
    func pinFile(_ id:String)->URL? {
        guard UUID(uuidString:id) != nil,let p=pinRecord(id),p["kind"] as? String == "file",let name=p["fileName"] as? String,!name.isEmpty,name != ".",name != "..",!name.contains("/"),!name.contains("\\") else{return nil}
        let root=folder.appendingPathComponent("Pins",isDirectory:true).resolvingSymlinksInPath()
        let url=root.appendingPathComponent(id,isDirectory:true).appendingPathComponent(name).resolvingSymlinksInPath()
        guard url.path.hasPrefix(root.path+"/"),(try? url.resourceValues(forKeys:[.isRegularFileKey]).isRegularFile)==true else{return nil}
        return url
    }
    func copyPin(_ id:String){
        guard let p=pinRecord(id) else{return}
        let paste=NSPasteboard.general
        if p["kind"] as? String == "link",let text=p["url"] as? String,let url=URL(string:text),(["http","https"].contains(url.scheme?.lowercased() ?? "") || (url.isFileURL && (url.host == nil || url.host == "" || url.host == "localhost"))) {paste.clearContents();paste.setString(text,forType:.string);send("pinMessage","Link copied.")}
        else if let url=pinFile(id){paste.clearContents();paste.writeObjects([url as NSURL]);send("pinMessage","File copied. Paste it where you need it.")}
        else {send("pinMessage","This file is missing. Please pin it again.")}
    }
    func addPinFiles(){
        let dialog=NSOpenPanel();dialog.canChooseDirectories=false;dialog.allowsMultipleSelection=true;dialog.message="Pin a local copy of your résumé or another file. Originals stay unchanged.";dialog.prompt="Pin files"
        NSApp.activate(ignoringOtherApps:true)
        dialog.begin{[weak self] result in
            guard let self,result == .OK else{return}
            let capacity=max(0,200-((self.currentState?["pins"] as? [Any])?.count ?? 0))
            var added=[[String:Any]]();var failed=false
            for url in dialog.urls.prefix(capacity){
                do {
                    let values=try url.resourceValues(forKeys:[.isRegularFileKey,.fileSizeKey]);guard values.isRegularFile==true,(values.fileSize ?? 0)<=50_000_000 else{failed=true;continue}
                    let id=UUID().uuidString;let dir=self.folder.appendingPathComponent("Pins",isDirectory:true).appendingPathComponent(id,isDirectory:true)
                    try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
                    try FileManager.default.copyItem(at:url,to:dir.appendingPathComponent(url.lastPathComponent))
                    added.append(["id":id,"kind":"file","title":String(url.deletingPathExtension().lastPathComponent.prefix(120)),"fileName":url.lastPathComponent,"size":values.fileSize ?? 0,"created":Date().timeIntervalSince1970*1000])
                }catch{failed=true}
            }
            self.send("pinsAdded",added);self.focusPanel()
            if failed{self.send("pinMessage","Some files could not be pinned. Choose files under 50 MB.")}
        }
    }
    func draggingSession(_ session:NSDraggingSession,sourceOperationMaskFor context:NSDraggingContext)->NSDragOperation{.copy}
    func draggingSession(_ session:NSDraggingSession,endedAt screenPoint:NSPoint,operation:NSDragOperation){pendingPinURL=nil;pinMouseDown=nil}
    func importState(){let dialog=NSOpenPanel();dialog.allowedContentTypes=[.json];dialog.allowsMultipleSelection=false;dialog.message="Choose a Panda backup. Import replaces your current Panda data.";NSApp.activate(ignoringOtherApps:true);dialog.begin{[weak self] result in guard result == .OK,let url=dialog.url,let self else{return};do{let data=try Data(contentsOf:url);guard data.count<5_000_000 else{throw CocoaError(.fileReadTooLarge)};let value=try JSONSerialization.jsonObject(with:data);if let old=self.currentState{try JSONSerialization.data(withJSONObject:old).write(to:self.folder.appendingPathComponent("before-import-\(Int(Date().timeIntervalSince1970)).json"),options:.atomic)};self.send("import",value)}catch{self.send("error","This file could not be imported. Your current data is unchanged.")}}}
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void){guard let url=action.request.url else{decisionHandler(.cancel);return};decisionHandler(url.isFileURL&&url.standardizedFileURL.path.hasPrefix(webRoot.standardizedFileURL.path+"/") ? .allow:.cancel)}
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView){ready=false;web.configuration.userContentController.removeAllUserScripts();let js="window.__PANDA_SAVED__=\(Self.json(currentState as Any? ?? NSNull()));window.__PANDA_CONFIG__=\(Self.json(configuration()));";web.configuration.userContentController.addUserScript(WKUserScript(source:js,injectionTime:.atDocumentStart,forMainFrameOnly:true));webView.reload()}
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply{if quitting{return .terminateNow};quitting=true;send("sleep");DispatchQueue.main.asyncAfter(deadline:.now()+0.4){sender.reply(toApplicationShouldTerminate:true)};return .terminateLater}
    func applicationWillTerminate(_ notification:Notification){ticker?.invalidate();if let outsideLocalMonitor{NSEvent.removeMonitor(outsideLocalMonitor)};if let pinDragMonitor{NSEvent.removeMonitor(pinDragMonitor)};if let hotKey{UnregisterEventHotKey(hotKey)};if let clickMonitor{NSEvent.removeMonitor(clickMonitor)}}
}
let app=NSApplication.shared
let delegate=AppDelegate()
app.delegate=delegate
app.run()
