import AppKit
import Vision

final class TextCapture {
    private var busy = false
    func capture(hide:()->Void, completion:@escaping (String)->Void) {
        guard !busy else{return}
        // Interactive capture is authorized by macOS when the person draws a
        // selection. Do not block it on a separate, stale full-screen preflight.
        busy=true;hide()
        let file=FileManager.default.temporaryDirectory.appendingPathComponent("panda-capture-\(UUID().uuidString).png")
        let process=Process()
        process.executableURL=URL(fileURLWithPath:"/usr/sbin/screencapture")
        process.arguments=["-i","-s","-x",file.path]
        process.terminationHandler={ [weak self] process in
            DispatchQueue.global(qos:.userInitiated).async {
                defer{try? FileManager.default.removeItem(at:file)}
                var message=process.terminationStatus == 0 ? "Capture cancelled." : "Capture did not finish. Try again; press Escape to cancel selection."
                if FileManager.default.fileExists(atPath:file.path) {
                    do {
                        let text=try Self.recognize(file)
                        if text.isEmpty {message="No text found. Try a clearer or larger selection."}
                        else {DispatchQueue.main.sync {NSPasteboard.general.clearContents();NSPasteboard.general.setString(text,forType:.string)};message="Text copied. Paste it anywhere with ⌘V."}
                    }catch{message="Could not read the selection. Please try again."}
                }
                let result=message
                DispatchQueue.main.async{self?.busy=false;completion(result)}
            }
        }
        do{try process.run()}catch{busy=false;completion("Could not start screen selection.")}
    }
    static func recognize(_ file:URL)throws->String{
        let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=true;request.automaticallyDetectsLanguage=true
        try VNImageRequestHandler(url:file,options:[:]).perform([request])
        return (request.results ?? []).compactMap{$0.topCandidates(1).first?.string}.joined(separator:"\n")
    }
}
