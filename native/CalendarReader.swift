import Foundation
import EventKit

// EventKit owns authentication and provider sync. No Google credentials leave Calendar.
final class CalendarReader {
    private lazy var store = EKEventStore()
    var selectedIDs: () -> [String] = { [] }
    var isConnected: () -> Bool = { false }
    var tasks: () -> [[String:Any]] = { [] }
    var publish: (String, Any) -> Void = { _, _ in }
    private var changeObserver: NSObjectProtocol?
    private var pendingRefresh: DispatchWorkItem?
    init() {
        changeObserver = NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.isConnected() else { return }
            self.pendingRefresh?.cancel()
            let task = DispatchWorkItem { [weak self] in self?.refresh() }
            self.pendingRefresh = task
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: task)
        }
    }
    deinit { if let changeObserver { NotificationCenter.default.removeObserver(changeObserver) }; pendingRefresh?.cancel() }
    func connect() {
        guard EKEventStore.authorizationStatus(for: .event) == .notDetermined else { refresh(); return }
        store.requestFullAccessToEvents { [weak self] _, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let error { self.publish("calendarInfo", ["status":"error", "message":error.localizedDescription, "calendars":[]] as [String:Any]) }
                else { self.store.reset(); self.refresh() }
            }
        }
    }
    private func taskID(_ event: EKEvent) -> String? {
        guard let url=event.url,url.scheme=="panda",url.host=="task" else {return nil}
        let id=url.lastPathComponent
        return UUID(uuidString:id) == nil ? nil : id
    }
    private func payload(_ event: EKEvent) -> [String:Any] {
        let start=event.startDate.timeIntervalSince1970*1000
        let title=(event.title ?? "").trimmingCharacters(in:.whitespacesAndNewlines)
        var data:[String:Any] = ["id":"\(event.calendar.calendarIdentifier):\(event.calendarItemIdentifier):\(Int(start))", "eventId":event.calendarItemIdentifier,"calendarId":event.calendar.calendarIdentifier,"title":String((title.isEmpty ? "Untitled event" : title).prefix(500)),"start":start,"end":event.endDate.timeIntervalSince1970*1000,"allDay":event.isAllDay,"calendarLabel":event.calendar.title,"writable":event.calendar.allowsContentModifications]
        if let id=taskID(event){data["taskId"]=id}
        return data
    }
    private func findEvent(task: [String:Any], in candidates: [EKEvent]) -> EKEvent? {
        guard let id=task["id"] as? String else{return nil}
        let link=task["calendarLink"] as? [String:Any]
        if let identifier=link?["eventId"] as? String,let e=store.calendarItem(withIdentifier:identifier) as? EKEvent,taskID(e)==id {return e}
        if let e=candidates.first(where:{taskID($0)==id}){return e}
        // A provider can replace identifiers after syncing. Recover by our stable task URL.
        if let start=link?["start"] as? Double,let end=link?["end"] as? Double,start.isFinite,end.isFinite {
            let p=store.predicateForEvents(withStart:Date(timeIntervalSince1970:start/1000-86400),end:Date(timeIntervalSince1970:end/1000+86400),calendars:nil)
            return store.events(matching:p).first(where:{taskID($0)==id})
        }
        return nil
    }
    private func todayEvents() -> [EKEvent] {
        let start=Calendar.current.startOfDay(for:Date())
        let end=Calendar.current.date(byAdding:.day,value:8,to:start)!
        return store.events(matching:store.predicateForEvents(withStart:start,end:end,calendars:nil)).filter{$0.status != .canceled}
    }
    func refresh() {
        let auth=EKEventStore.authorizationStatus(for:.event)
        guard auth == .fullAccess else {
            publish("calendarInfo", ["status":auth == .denied || auth == .restricted ? "denied":"notConnected","calendars":[]] as [String:Any])
            if isConnected(){publish("calendarSnapshot",[])}
            return
        }
        let calendars=store.calendars(for:.event).sorted{$0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending}
        publish("calendarInfo",["status":"authorized","defaultCalendarId":store.defaultCalendarForNewEvents?.calendarIdentifier ?? "","calendars":calendars.map{["id":$0.calendarIdentifier,"title":$0.title,"source":$0.source.title,"writable":$0.allowsContentModifications] as [String:Any]}] as [String:Any])
        guard isConnected() else{return}
        let all=todayEvents(),ids=Set(selectedIDs())
        var seen=Set<String>()
        let events=all.filter{ids.contains($0.calendar.calendarIdentifier)}.sorted{$0.startDate<$1.startDate}.prefix(1000).compactMap{event -> [String:Any]? in
            let data=payload(event);guard seen.insert(data["id"] as! String).inserted else{return nil};return data
        }
        publish("calendarSnapshot",events)
        // Resolve saved links independently of the visible date range; moving tomorrow is not deletion.
        let links=tasks().filter{$0["calendarLink"] != nil}.map{task -> [String:Any] in
            if let event=findEvent(task:task,in:all){return ["taskId":task["id"]!,"event":payload(event)]}
            return ["taskId":task["id"]!,"missing":true]
        }
        publish("calendarLinks",links)
    }
    func write(_ request:[String:Any]) {
        let requestID=request["requestId"] as? String ?? ""
        func fail(_ message:String){publish("calendarWriteResult",["requestId":requestID,"error":message])}
        guard EKEventStore.authorizationStatus(for:.event) == .fullAccess,isConnected() else {fail("Connect Mac Calendar in Preferences first.");return}
        guard let id=request["taskId"] as? String,UUID(uuidString:id) != nil,let task=tasks().first(where:{$0["id"] as? String == id}) else {fail("This task no longer exists.");return}
        let existing=findEvent(task:task,in:todayEvents())
        let removing=request["operation"] as? String == "remove"
        if removing {
            guard let event=existing else {publish("calendarWriteResult",["requestId":requestID,"taskId":id,"removed":true]);refresh();return}
            guard event.calendar.allowsContentModifications,event.hasRecurrenceRules == false else {fail("This event is read-only or recurring. Edit it in Calendar.");return}
            do {try store.remove(event,span:.thisEvent,commit:true);publish("calendarWriteResult",["requestId":requestID,"taskId":id,"removed":true]);refresh()}
            catch {fail(error.localizedDescription)}
            return
        }
        guard let start=request["start"] as? Double,let end=request["end"] as? Double,start.isFinite,end.isFinite,end>start,end-start<=86400000 else {fail("Choose a valid start and end time.");return}
        guard let calendarID=request["calendarId"] as? String,selectedIDs().contains(calendarID),let calendar=store.calendar(withIdentifier:calendarID),calendar.allowsContentModifications else {fail("Choose a writable calendar from your connected calendars.");return}
        if task["calendarLink"] != nil && existing == nil {fail("The linked event is no longer available. Unlink it before scheduling again.");return}
        if let event=existing,(!event.calendar.allowsContentModifications || event.hasRecurrenceRules){fail("This event is read-only or recurring. Edit it in Calendar.");return}
        let event=existing ?? EKEvent(eventStore:store)
        let title=(request["title"] as? String ?? task["title"] as? String ?? "Task").trimmingCharacters(in:.whitespacesAndNewlines)
        guard !title.isEmpty else {fail("Give the task a name first.");return}
        event.title=String(title.prefix(500));event.calendar=calendar;event.startDate=Date(timeIntervalSince1970:start/1000);event.endDate=Date(timeIntervalSince1970:end/1000)
        event.isAllDay=false;event.url=URL(string:"panda://task/\(id)")
        do {try store.save(event,span:.thisEvent,commit:true);publish("calendarWriteResult",["requestId":requestID,"taskId":id,"event":payload(event)]);refresh()}
        catch {fail(error.localizedDescription)}
    }
}
