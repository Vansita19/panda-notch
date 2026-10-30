import Foundation
import Darwin

private struct Failure: Error, CustomStringConvertible { let description: String }
private func expect(_ value: @autoclosure () throws -> Bool, _ message: String) throws {
    if try !value() { throw Failure(description: message) }
}
private func json(_ value: Any) throws -> Data { try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) }
private func iso(_ text: String) -> Date { ISO8601DateFormatter().date(from: text)! }

private final class Fixture {
    let root = URL(fileURLWithPath: "/private/tmp/panda-campaign-tests-\(UUID().uuidString)", isDirectory: true)
    var now = iso("2026-10-30T17:00:00Z")
    var messages: [(String, Any)] = []
    lazy var bridge = CampaignBridge(directoryPath: root.path, now: { [unowned self] in self.now }, publish: { [unowned self] in self.messages.append(($0, $1)) })
    init() throws { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true) }
    deinit { try? FileManager.default.removeItem(at: root) }
    func write(_ value: Any, name: String = "brief.json") throws { try json(value).write(to: root.appendingPathComponent(name), options: .atomic) }
    var deliveries: [[String: Any]] { messages.filter { $0.0 == "campaignBrief" }.compactMap { $0.1 as? [String: Any] } }
    var brief: [String: Any] { ["schema_version": 1, "campaign_id": "november-2026", "timezone": "Asia/Kolkata", "date": "2026-11-01", "revision": 1, "issued_at": "2026-10-30T16:00:00Z", "opening": "Prepared future guidance"] }
    var progress: [String: Any] {
        ["schema_version": 1, "campaign_id": "november-2026", "timezone": "Asia/Kolkata", "checked_at": "2026-10-30T17:00:00.000Z", "date": "2026-10-30", "app_state": "running",
         "brief": ["source": "fallback", "date": NSNull(), "revision": NSNull(), "issued_at": NSNull()],
         "days": [["date": "2026-11-01", "tasks": [["task_id": "campaign-1", "slot": "project", "work_id": "website-brief", "title": "Write brief", "status": "pending", "carried_from": NSNull(), "start": "2026-11-01T09:30:00.000Z", "end": "2026-11-01T11:30:00.000Z", "evidence": [["ref": "https://example.com/work", "self_review": "Clearer opening"]]]]]],
         "applications": ["date": "2026-10-30", "tracker_id": "job-applications", "count": NSNull(), "slots": 15, "source": "unavailable"]]
    }
}

@main private struct CampaignBridgeTests {
    static func main() throws {
        let tests: [(String, () throws -> Void)] = [
            ("exports a whole month of reviews and preserves it if the bounded cap is exceeded", {
                let f = try Fixture(); var progress = f.progress
                func month(_ unicode: Bool) -> [[String: Any]] {
                    let slots = ["applications", "visibility", "portfolio", "project", "learning", "interview"]
                    return (1...30).map { number in
                        let date = String(format: "2026-11-%02d", number)
                        let tasks: [[String: Any]] = slots.map { slot in
                            let evidence: [[String: Any]] = (0..<3).map { _ in ["ref": "/" + String(repeating: unicode ? "你" : "a", count: 3000), "self_review": String(repeating: unicode ? "你" : "b", count: 2000)] }
                            return ["task_id": "task-" + date + slot, "slot": slot, "work_id": "work-" + slot, "title": slot, "status": "pending", "carried_from": NSNull(), "start": NSNull(), "end": NSNull(), "evidence": evidence]
                        }
                        return ["date": date, "tasks": tasks]
                    }
                }
                progress["days"] = month(false)
                try expect(try json(progress).count > 512 * 1024, "fixture must exceed the old cap")
                try expect(f.bridge.exportProgress(progress), "valid month of reviews could not be shared")
                let saved = try Data(contentsOf: f.root.appendingPathComponent("progress.json"))
                progress["days"] = month(true)
                try expect(try json(progress).count > CampaignBridge.progressLimit, "fixture must exceed the bounded cap")
                try expect(!f.bridge.exportProgress(progress), "oversized projection accepted")
                try expect(try Data(contentsOf: f.root.appendingPathComponent("progress.json")) == saved, "previous projection lost on oversized export")
            }),
            ("local directory pointer is bounded and rejects nonregular or linked files", {
                let f = try Fixture(), file = f.root.appendingPathComponent("campaign-bridge-location.txt")
                try Data((f.root.path + "\n").utf8).write(to: file)
                try expect(CampaignBridge.readDirectoryPointer(file.path) == f.root.path, "authorized pointer was not read")
                for text in ["relative/path", "/first\n/second", String(repeating: "/", count: 4097)] {
                    try Data(text.utf8).write(to: file)
                    try expect(CampaignBridge.readDirectoryPointer(file.path) == nil, "invalid pointer accepted")
                }
                try FileManager.default.removeItem(at: file)
                try expect(mkfifo(file.path, 0o600) == 0, "test FIFO creation failed")
                try expect(CampaignBridge.readDirectoryPointer(file.path) == nil, "FIFO pointer accepted")
                try FileManager.default.removeItem(at: file)
                let target = f.root.appendingPathComponent("target.txt"); try Data(f.root.path.utf8).write(to: target)
                try FileManager.default.createSymbolicLink(at: file, withDestinationURL: target)
                try expect(CampaignBridge.readDirectoryPointer(file.path) == nil, "symlink pointer accepted")
            }),
            ("delivers raw future/stale dates for engine validation", {
                let f = try Fixture(); try f.write(f.brief); f.bridge.poll()
                try expect(f.deliveries.count == 1, "future brief was not delivered to engine")
                try expect(f.deliveries[0]["date"] as? String == "2026-11-01", "transport changed date")
                var stale = f.brief; stale["date"] = "2026-10-29"; stale["revision"] = 2
                try f.write(stale); f.bridge.poll()
                try expect(f.deliveries.count == 2, "stale brief must reach engine validation")
            }),
            ("deduplicates bytes but redelivers on ready and IST rollover", {
                let f = try Fixture(); try f.write(f.brief); f.bridge.poll(); f.bridge.poll()
                try expect(f.deliveries.count == 1, "unchanged brief delivered repeatedly")
                f.bridge.poll(force: true)
                try expect(f.deliveries.count == 2, "ready refresh lost latest brief")
                f.now = iso("2026-10-30T18:30:00Z"); f.bridge.poll()
                try expect(f.deliveries.count == 3, "IST midnight did not reconsider future brief")
            }),
            ("rejects corrupt, oversized, and wrong campaign envelopes", {
                let f = try Fixture(); let file = f.root.appendingPathComponent("brief.json")
                try Data("{broken".utf8).write(to: file); f.bridge.poll()
                try Data(repeating: 32, count: 128 * 1024 + 1).write(to: file); f.bridge.poll()
                for (key, value) in [("schema_version", 2 as Any), ("schema_version", true), ("campaign_id", "another"), ("timezone", "UTC")] {
                    var brief = f.brief; brief[key] = value; try f.write(brief); f.bridge.poll()
                }
                try expect(f.deliveries.isEmpty, "invalid brief escaped validation")
                try expect(f.messages.contains { $0.0 == "campaignBridgeStatus" }, "file errors did not report bounded status")
            }),
            ("rejects symlink files, directories, and traversal paths", {
                let f = try Fixture(); try f.write(f.brief, name: "other.json")
                try FileManager.default.createSymbolicLink(atPath: f.root.appendingPathComponent("brief.json").path, withDestinationPath: "other.json")
                f.bridge.poll(); try expect(f.deliveries.isEmpty, "symlink brief was read")
                let real = f.root.appendingPathComponent("real", isDirectory: true)
                try FileManager.default.createDirectory(at: real, withIntermediateDirectories: false)
                try json(f.brief).write(to: real.appendingPathComponent("brief.json"))
                let link = f.root.appendingPathComponent("linked"); try FileManager.default.createSymbolicLink(at: link, withDestinationURL: real)
                let bridge = CampaignBridge(directoryPath: link.path, publish: { f.messages.append(($0, $1)) }); bridge.poll()
                let traversal = CampaignBridge(directoryPath: f.root.path + "/../" + f.root.lastPathComponent, publish: { f.messages.append(($0, $1)) }); traversal.poll()
                try expect(f.deliveries.isEmpty, "unsafe directory was read")
                try expect(!bridge.exportProgress(f.progress), "progress followed directory symlink")
                try expect(!traversal.exportProgress(f.progress), "progress accepted path traversal")
            }),
            ("rejects relative and duplicate-slash directory paths", {
                let f = try Fixture(); try f.write(f.brief)
                for path in ["relative/bridge", f.root.path + "//", "/" + f.root.path] {
                    let bridge = CampaignBridge(directoryPath: path, publish: { f.messages.append(($0, $1)) })
                    bridge.poll(); try expect(!bridge.exportProgress(f.progress), "unsafe path accepted")
                }
                try expect(f.deliveries.isEmpty, "unsafe path delivered guidance")
            }),
            ("does not block or read nonregular brief files", {
                let f = try Fixture(); let path = f.root.appendingPathComponent("brief.json").path
                try expect(mkfifo(path, 0o600) == 0, "test FIFO creation failed")
                f.bridge.poll(); try expect(f.deliveries.isEmpty, "FIFO brief accepted")
            }),
            ("atomically exports exact minimal progress and preserves checked_at", {
                let f = try Fixture(); let progress = f.progress
                try expect(f.bridge.exportProgress(progress), "valid progress rejected")
                let saved = try Data(contentsOf: f.root.appendingPathComponent("progress.json"))
                try expect(saved == (try json(progress)), "progress was changed or expanded")
                try expect((try FileManager.default.contentsOfDirectory(atPath: f.root.path)) == ["progress.json"], "temporary export file leaked")
            }),
            ("rejects unrelated nested payloads and preserves previous export", {
                let f = try Fixture(); try expect(f.bridge.exportProgress(f.progress), "baseline export failed")
                let url = f.root.appendingPathComponent("progress.json"), previous = try Data(contentsOf: url)
                var extra = f.progress; extra["notes"] = ["private note"]; try expect(!f.bridge.exportProgress(extra), "unrelated top-level state exported")
                var evidence = f.progress; var days = evidence["days"] as! [[String: Any]], tasks = days[0]["tasks"] as! [[String: Any]]
                tasks[0]["notes"] = "private task note"; days[0]["tasks"] = tasks; evidence["days"] = days
                try expect(!f.bridge.exportProgress(evidence), "unrelated task field exported")
                var large = f.progress; let template = (f.progress["days"] as! [[String: Any]])[0]["tasks"] as! [[String: Any]]
                let largeTasks = (0..<100).map { index -> [String: Any] in
                    var task = template[0]; task["task_id"] = "campaign-\(index)"; task["evidence"] = [["ref": "https://example.com/work", "self_review": String(repeating: "x", count: 8000)]]
                    return task
                }
                large["days"] = [["date": "2026-11-01", "tasks": largeTasks]]
                try expect((try json(large)).count > 512 * 1024, "oversized test fixture was too small")
                try expect(!f.bridge.exportProgress(large), "export exceeding daily task and review limits accepted")
                try expect(try Data(contentsOf: url) == previous, "rejected export replaced last valid progress")
            }),
            ("rejects unrelated day, evidence, application, and brief fields", {
                let f = try Fixture()
                for container in ["brief", "applications"] {
                    var progress = f.progress, nested = progress[container] as! [String: Any]
                    nested["contacts"] = ["private contact"]; progress[container] = nested
                    try expect(!f.bridge.exportProgress(progress), "unrelated \(container) field exported")
                }
                var dayExtra = f.progress, days = dayExtra["days"] as! [[String: Any]]
                days[0]["calendar"] = "private calendar"; dayExtra["days"] = days
                try expect(!f.bridge.exportProgress(dayExtra), "unrelated day field exported")
                var evidenceExtra = f.progress; days = evidenceExtra["days"] as! [[String: Any]]
                var tasks = days[0]["tasks"] as! [[String: Any]]
                tasks[0]["evidence"] = [["ref": "https://example.com/work", "raw_file": "private file bytes"]]
                days[0]["tasks"] = tasks; evidenceExtra["days"] = days
                try expect(!f.bridge.exportProgress(evidenceExtra), "unrelated evidence field exported")
                try expect(!FileManager.default.fileExists(atPath: f.root.appendingPathComponent("progress.json").path), "invalid projection created export")
            }),
            ("keeps application counts and snapshot timestamps honest", {
                let f = try Fixture()
                var progress = f.progress; progress["checked_at"] = "yesterday"
                try expect(!f.bridge.exportProgress(progress), "non-timestamp checked_at accepted")
                progress = f.progress; var applications = progress["applications"] as! [String: Any]
                applications["count"] = 0; progress["applications"] = applications
                try expect(!f.bridge.exportProgress(progress), "unavailable tracker exported invented count")
                applications["source"] = "tracker"; applications["count"] = true; progress["applications"] = applications
                try expect(!f.bridge.exportProgress(progress), "boolean accepted as application count")
                applications["count"] = 7; progress["applications"] = applications
                try expect(f.bridge.exportProgress(progress), "real tracker count rejected")
            }),
            ("exports explicitly unscheduled work and encoded long work identities", {
                let f = try Fixture(); var progress = f.progress, days = progress["days"] as! [[String: Any]], tasks = days[0]["tasks"] as! [[String: Any]]
                tasks[0]["task_id"] = "campaign:november-2026:" + String(repeating: "%E4%BD%A0", count: 200)
                tasks[0]["work_id"] = String(repeating: "你", count: 200)
                tasks[0]["start"] = NSNull(); tasks[0]["end"] = NSNull()
                tasks[0]["evidence"] = [["ref": "/" + String(repeating: "你", count: 3000), "self_review": String(repeating: "你", count: 2000)]]
                days[0]["tasks"] = tasks; progress["days"] = days
                try expect(f.bridge.exportProgress(progress), "valid unscheduled or Unicode campaign snapshot rejected")
            }),
            ("rejects hard-linked brief and progress files", {
                let f = try Fixture(); try f.write(f.brief, name: "private.json")
                try FileManager.default.linkItem(at: f.root.appendingPathComponent("private.json"), to: f.root.appendingPathComponent("brief.json"))
                f.bridge.poll(); try expect(f.deliveries.isEmpty, "hard-linked brief accepted")
                try FileManager.default.linkItem(at: f.root.appendingPathComponent("private.json"), to: f.root.appendingPathComponent("progress.json"))
                try expect(!f.bridge.exportProgress(f.progress), "hard-linked progress target accepted")
            }),
            ("rejects symlink progress target without touching its destination", {
                let f = try Fixture(); let target = f.root.appendingPathComponent("private.json")
                try Data("private".utf8).write(to: target)
                try FileManager.default.createSymbolicLink(at: f.root.appendingPathComponent("progress.json"), withDestinationURL: target)
                try expect(!f.bridge.exportProgress(f.progress), "symlink progress target accepted")
                try expect(try String(contentsOf: target, encoding: .utf8) == "private", "symlink destination was changed")
            }),
            ("creates only the authorized missing bridge directory on export", {
                let f = try Fixture(), child = f.root.appendingPathComponent("campaign/panda-bridge")
                let bridge = CampaignBridge(directoryPath: child.path, publish: { _, _ in })
                bridge.poll(); try expect(!FileManager.default.fileExists(atPath: child.path), "read poll created directories")
                try expect(bridge.exportProgress(f.progress), "authorized directory could not be created")
                try expect(FileManager.default.fileExists(atPath: child.appendingPathComponent("progress.json").path), "progress not in authorized directory")
            })
        ]
        for (name, test) in tests { do { try test(); print("PASS \(name)") } catch { fputs("FAIL \(name): \(error)\n", stderr); exit(1) } }
        print("\(tests.count) native bridge tests passed")
    }
}
