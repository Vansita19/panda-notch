import AppKit
import ImageIO
import UniformTypeIdentifiers

// Read metadata only from an already-running Spotify tab in Brave. Never starts playback.
// One bounded process at a time, on a five-second interval; no audio recording.
final class NowPlaying {
    var publish: (String,Any)->Void = {_,_ in}
    private var enabled=false
    private var blocked=false
    private var busy=false
    private var lastArtwork=""
    private var imageData=""
    private var artworkTask:URLSessionDataTask?
    private var latestMetadata:[String:Any]=[:]
    deinit {artworkTask?.cancel()}
    func configure(_ on:Bool){guard enabled != on else{return};enabled=on;blocked=false;if on{refresh()}else{artworkTask?.cancel();publish("nowPlaying",NSNull())}}
    func refresh(){
        guard enabled,!busy,!blocked else{return}
        guard NSRunningApplication.runningApplications(withBundleIdentifier:"com.brave.Browser").isEmpty == false else {publish("nowPlaying",NSNull());return}
        busy=true
        let script=#"""
        const app=Application('com.brave.Browser');
        let result={state:'stopped'};
        const read="JSON.stringify((()=>{const m=navigator.mediaSession;if(!m||!m.metadata)return {state:'stopped'};const d=m.metadata;return {state:m.playbackState==='playing'?'playing':'paused',title:d.title,artist:d.artist,artwork:d.artwork?.[0]?.src||''};})())";
        for(const win of app.windows()) {
          for(const tab of win.tabs()) {
            if(/^https:\/\/open\.spotify\.com(?:\/|$)/.test(tab.url())) {
              const value=JSON.parse(tab.execute({javascript:read}));
              if(value.state==='playing'){result=value;break;}
              if(result.state==='stopped')result=value;
            }
          }
          if(result.state==='playing')break;
        }
        JSON.stringify(result);
        """#
        DispatchQueue.global(qos:.utility).async{[weak self] in
            let process=Process(),out=Pipe(),err=Pipe()
            process.executableURL=URL(fileURLWithPath:"/usr/bin/osascript");process.arguments=["-l","JavaScript","-e",script];process.standardOutput=out;process.standardError=err
            do{try process.run()}catch{DispatchQueue.main.async{self?.busy=false};return}
            let timeout=DispatchWorkItem{if process.isRunning{process.terminate()}}
            DispatchQueue.global(qos:.utility).asyncAfter(deadline:.now()+8,execute:timeout)
            let data=out.fileHandleForReading.readDataToEndOfFile(),errorData=err.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit();timeout.cancel()
            let errorText=String(data:errorData,encoding:.utf8) ?? ""
            let parsed=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any]
            DispatchQueue.main.async{
                guard let self else{return};self.busy=false;guard self.enabled else{return}
                if errorText.contains("-1743"){self.blocked=true;self.publish("musicStatus","Allow Panda to read Brave in System Settings → Privacy & Security → Automation. Turn music off and on here to retry.");return}
                if errorText.localizedCaseInsensitiveContains("javascript") {self.blocked=true;self.publish("musicStatus","In Brave, enable View → Developer → Allow JavaScript from Apple Events. Then turn Spotify in the notch off and on to retry.");return}
                guard let parsed else{self.publish("nowPlaying",NSNull());return}
                self.receive(parsed)
            }
        }
    }
    private func receive(_ raw:[String:Any]){
        guard let state=raw["state"] as? String,state != "stopped" else{latestMetadata=[:];artworkTask?.cancel();publish("nowPlaying",NSNull());return}
        let urlString=raw["artwork"] as? String ?? ""
        let payload:[String:Any]=["title":raw["title"] as? String ?? "Spotify","artist":raw["artist"] as? String ?? "","playing":state=="playing","artwork":urlString==lastArtwork ? imageData : ""]
        latestMetadata=payload;publish("nowPlaying",payload)
        guard urlString != lastArtwork else{return};lastArtwork=urlString;imageData="";artworkTask?.cancel()
        guard let url=URL(string:urlString),url.scheme=="https",let hostname=url.host,["i.scdn.co","mosaic.scdn.co"].contains(hostname) else{return}
        var request=URLRequest(url:url);request.timeoutInterval=8
        artworkTask=URLSession.shared.dataTask(with:request){[weak self] data,response,_ in
            guard let data,data.count<4_000_000,let response=response as? HTTPURLResponse,response.statusCode==200,let source=CGImageSourceCreateWithData(data as CFData,nil) else{return}
            let options:[CFString:Any]=[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:64,kCGImageSourceCreateThumbnailWithTransform:true]
            guard let thumbnail=CGImageSourceCreateThumbnailAtIndex(source,0,options as CFDictionary) else{return}
            let png=NSMutableData()
            guard let destination=CGImageDestinationCreateWithData(png,UTType.png.identifier as CFString,1,nil) else{return}
            CGImageDestinationAddImage(destination,thumbnail,nil);guard CGImageDestinationFinalize(destination) else{return}
            let value="data:image/png;base64,"+(png as Data).base64EncodedString()
            DispatchQueue.main.async{guard let self,self.enabled,!self.latestMetadata.isEmpty,self.lastArtwork==urlString else{return};self.imageData=value;self.latestMetadata["artwork"]=value;self.publish("nowPlaying",self.latestMetadata)}
        };artworkTask?.resume()
    }
}
