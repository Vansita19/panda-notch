import Foundation
import CoreFoundation
import Darwin

/// File transport only. The web model owns all campaign reconciliation and app state.
final class CampaignBridge {
    static var defaultDirectory: String {
        let root = ProcessInfo.processInfo.environment["PANDA_DATA_DIR"] ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Panda").path
        return readDirectoryPointer(root + "/campaign-bridge-location.txt") ?? root + "/Campaign"
    }
    // Machine-specific coordination paths stay in local configuration, outside source control.
    static func readDirectoryPointer(_ path: String) -> String? {
        let file = open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
        guard file >= 0 else { return nil }
        defer { close(file) }
        var metadata = stat()
        guard fstat(file, &metadata) == 0, metadata.st_mode & S_IFMT == S_IFREG, metadata.st_nlink == 1, metadata.st_size > 0, metadata.st_size <= 4096 else { return nil }
        var bytes = [UInt8](repeating: 0, count: 4097)
        let count = read(file, &bytes, bytes.count)
        guard count > 0, count <= 4096, let text = String(bytes: bytes.prefix(count), encoding: .utf8) else { return nil }
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.hasPrefix("/"), !value.contains("\n"), !value.contains("\r"), !value.contains("\0") else { return nil }
        return value
    }
    static let briefLimit = 128 * 1024
    // The authoritative app state is already bounded to 5 MB. The minimal projection
    // must accommodate its month of snapshots and explicitly supplied reviews.
    static let progressLimit = 5_000_000
    private let directoryPath: String
    private let now: () -> Date
    private let publish: (String, Any) -> Void
    private var lastBriefData: Data?
    private var lastDeliveryDay: String?
    private var statuses: [String: String] = [:]
    private static let slots: Set<String> = ["applications", "visibility", "portfolio", "project", "learning", "interview"]

    private enum BridgeError: Error {
        case missing, unsafe, unavailable, tooLarge, malformed, envelope, progress
    }

    init(directoryPath: String? = nil, now: @escaping () -> Date = Date.init, publish: @escaping (String, Any) -> Void) {
        self.directoryPath = directoryPath ?? ProcessInfo.processInfo.environment["PANDA_CAMPAIGN_DIR"] ?? Self.defaultDirectory
        self.now = now
        self.publish = publish
    }

    /// Called every five seconds, and forced after web readiness or wake. Unchanged
    /// prepared guidance is reconsidered across IST midnight without native scheduling.
    func poll(force: Bool = false) {
        do {
            let directory = try openDirectory(create: false)
            defer { close(directory) }
            let data = try readBrief(directory)
            guard let object = try? JSONSerialization.jsonObject(with: data), let brief = object as? [String: Any] else { throw BridgeError.malformed }
            guard Self.campaignEnvelope(brief) else { throw BridgeError.envelope }
            let day = Self.istDay(now())
            if force || data != lastBriefData || day != lastDeliveryDay {
                publish("campaignBrief", brief)
                lastBriefData = data
                lastDeliveryDay = day
            }
            status("brief", code: "ready", message: "Coach guidance is available. Panda checks its campaign date.", force: force)
        } catch {
            status("brief", error: error, force: force)
        }
    }

    /// Accept only the minimal campaign projection, never a general app-state object.
    /// checked_at comes from the authoritative web snapshot and is kept unchanged.
    @discardableResult func exportProgress(_ progress: [String: Any]) -> Bool {
        do {
            guard JSONSerialization.isValidJSONObject(progress) else { throw BridgeError.progress }
            let data = try JSONSerialization.data(withJSONObject: progress, options: [.sortedKeys])
            guard data.count <= Self.progressLimit else { throw BridgeError.tooLarge }
            guard Self.validProgress(progress) else { throw BridgeError.progress }
            let directory = try openDirectory(create: true)
            defer { close(directory) }
            try writeProgress(data, directory: directory)
            status("progress", code: "saved", message: "Campaign progress is saved for the coach.")
            return true
        } catch {
            status("progress", error: error)
            return false
        }
    }

    // Open every path component with O_NOFOLLOW. Fixed relative filenames and retained
    // directory handles avoid path substitution between checking and reading/writing.
    private func openDirectory(create: Bool) throws -> Int32 {
        guard directoryPath.hasPrefix("/"), !directoryPath.contains("\0"), !directoryPath.contains("\\") else { throw BridgeError.unsafe }
        let components = directoryPath.split(separator: "/", omittingEmptySubsequences: false)
        guard components.count > 1 else { throw BridgeError.unsafe }
        var names = Array(components.dropFirst())
        if names.last?.isEmpty == true { names.removeLast() }
        guard !names.isEmpty, !names.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }) else { throw BridgeError.unsafe }
        var directory = open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard directory >= 0 else { throw BridgeError.unavailable }
        do {
            for component in names {
                let name = String(component)
                var next = openat(directory, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                if next < 0, errno == ENOENT, create {
                    guard mkdirat(directory, name, 0o700) == 0 || errno == EEXIST else { throw BridgeError.unavailable }
                    next = openat(directory, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                }
                guard next >= 0 else { throw Self.fileError() }
                close(directory)
                directory = next
            }
            return directory
        } catch {
            close(directory)
            throw error
        }
    }

    private func readBrief(_ directory: Int32) throws -> Data {
        let file = openat(directory, "brief.json", O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
        guard file >= 0 else { throw Self.fileError() }
        defer { close(file) }
        var metadata = stat()
        guard fstat(file, &metadata) == 0 else { throw BridgeError.unavailable }
        guard metadata.st_mode & S_IFMT == S_IFREG, metadata.st_nlink == 1 else { throw BridgeError.unsafe }
        guard metadata.st_size >= 0, metadata.st_size <= Self.briefLimit else { throw BridgeError.tooLarge }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 16 * 1024)
        while true {
            let count = read(file, &buffer, min(buffer.count, Self.briefLimit + 1 - data.count))
            if count == 0 { break }
            if count < 0 { if errno == EINTR { continue }; throw BridgeError.unavailable }
            data.append(contentsOf: buffer.prefix(count))
            guard data.count <= Self.briefLimit else { throw BridgeError.tooLarge }
        }
        return data
    }

    private func checkProgressTarget(_ directory: Int32) throws {
        var metadata = stat()
        if fstatat(directory, "progress.json", &metadata, AT_SYMLINK_NOFOLLOW) == 0 {
            guard metadata.st_mode & S_IFMT == S_IFREG, metadata.st_nlink == 1 else { throw BridgeError.unsafe }
        } else if errno != ENOENT { throw Self.fileError() }
    }

    private func writeProgress(_ data: Data, directory: Int32) throws {
        try checkProgressTarget(directory)
        let temporary = ".progress-\(UUID().uuidString).tmp"
        let file = openat(directory, temporary, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
        guard file >= 0 else { throw BridgeError.unavailable }
        defer { close(file); unlinkat(directory, temporary, 0) }
        try data.withUnsafeBytes { raw in
            var offset = 0
            while offset < raw.count {
                let count = write(file, raw.baseAddress!.advanced(by: offset), raw.count - offset)
                if count < 0 { if errno == EINTR { continue }; throw BridgeError.unavailable }
                guard count > 0 else { throw BridgeError.unavailable }
                offset += count
            }
        }
        guard fsync(file) == 0 else { throw BridgeError.unavailable }
        // A concurrently substituted symlink is never followed by renameat, and is
        // rejected when visible here. Existing valid progress survives failed writes.
        try checkProgressTarget(directory)
        guard renameat(directory, temporary, directory, "progress.json") == 0 else { throw BridgeError.unavailable }
    }

    private static func fileError() -> BridgeError {
        switch errno {
        case ENOENT: return .missing
        case ELOOP, ENOTDIR: return .unsafe
        default: return .unavailable
        }
    }

    private func status(_ operation: String, code: String, message: String, force: Bool = false) {
        guard force || statuses[operation] != code else { return }
        statuses[operation] = code
        publish("campaignBridgeStatus", ["operation": operation, "status": code, "message": message, "checked_at": ISO8601DateFormatter().string(from: now())])
    }

    private func status(_ operation: String, error: Error, force: Bool = false) {
        let code: String, message: String
        switch error as? BridgeError {
        case .missing:
            code = "missing"; message = "Coach guidance has not arrived. Panda can use its built-in routine."
        case .unsafe:
            code = "unsafe-file"; message = "The campaign bridge needs ordinary local files in a real folder."
        case .tooLarge:
            code = "too-large"; message = "The campaign file is too large. Panda kept the last valid guidance and progress."
        case .malformed, .envelope:
            code = "invalid-brief"; message = "This coach brief could not be read. Panda kept the last valid guidance."
        case .progress:
            code = "invalid-progress"; message = "Campaign progress was not exported because its snapshot was invalid."
        default:
            code = "unavailable"; message = "The campaign bridge is unavailable. Panda keeps working and will retry."
        }
        status(operation, code: code, message: message, force: force)
    }

    private static func campaignEnvelope(_ value: [String: Any]) -> Bool {
        integer(value["schema_version"], minimum: 1, maximum: 1) && value["campaign_id"] as? String == "november-2026" && value["timezone"] as? String == "Asia/Kolkata"
    }
    private static func keys(_ value: [String: Any], required: Set<String>, optional: Set<String> = []) -> Bool {
        let actual = Set(value.keys)
        return required.isSubset(of: actual) && actual.isSubset(of: required.union(optional))
    }
    private static func text(_ value: Any?, max: Int, empty: Bool = false) -> Bool {
        guard let value = value as? String else { return false }
        // Match the web model's string limits, including non-ASCII evidence text.
        return (empty || !value.isEmpty) && value.utf16.count <= max && !value.contains("\0")
    }
    private static func integer(_ value: Any?, minimum: Int, maximum: Int) -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return false }
        let numeric = number.doubleValue
        return numeric.isFinite && numeric.rounded() == numeric && numeric >= Double(minimum) && numeric <= Double(maximum)
    }
    private static func null(_ value: Any?) -> Bool { value is NSNull }
    private static func day(_ value: Any?) -> Bool {
        guard let value = value as? String, value.utf8.count == 10 else { return false }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
        guard let date = formatter.date(from: value) else { return false }
        return formatter.string(from: date) == value
    }
    private static func timestamp(_ value: Any?) -> Bool {
        guard let value = value as? String, value.utf8.count <= 40 else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: value) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value) != nil
    }
    private static func istDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(identifier: "Asia/Kolkata"); formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func validProgress(_ value: [String: Any]) -> Bool {
        guard keys(value, required: ["schema_version", "campaign_id", "timezone", "checked_at", "date", "app_state", "brief", "days", "applications"]), campaignEnvelope(value), timestamp(value["checked_at"]), day(value["date"]), let state = value["app_state"] as? String, ["running", "closed"].contains(state),
              let brief = value["brief"] as? [String: Any], keys(brief, required: ["source", "date", "revision", "issued_at"]), let source = brief["source"] as? String, ["coach", "fallback"].contains(source), day(brief["date"]) || null(brief["date"]), integer(brief["revision"], minimum: 1, maximum: Int.max) || null(brief["revision"]), timestamp(brief["issued_at"]) || null(brief["issued_at"]),
              let days = value["days"] as? [[String: Any]], days.count <= 30,
              let applications = value["applications"] as? [String: Any], keys(applications, required: ["date", "tracker_id", "count", "slots", "source"]), day(applications["date"]), applications["tracker_id"] as? String == "job-applications", integer(applications["slots"], minimum: 15, maximum: 15), let applicationSource = applications["source"] as? String else { return false }
        if applicationSource == "tracker" {
            guard integer(applications["count"], minimum: 0, maximum: 15) else { return false }
        } else if applicationSource == "unavailable" {
            guard null(applications["count"]) else { return false }
        } else { return false }
        var seenDays = Set<String>()
        for entry in days {
            guard keys(entry, required: ["date", "tasks"]), day(entry["date"]), let date = entry["date"] as? String, date.hasPrefix("2026-11-"), seenDays.insert(date).inserted, let tasks = entry["tasks"] as? [[String: Any]], tasks.count <= 6 else { return false }
            var seenIDs = Set<String>()
            for task in tasks {
                guard keys(task, required: ["task_id", "slot", "work_id", "title", "status", "carried_from", "start", "end"], optional: ["evidence"]), text(task["task_id"], max: 2500), let id = task["task_id"] as? String, seenIDs.insert(id).inserted, let slot = task["slot"] as? String, slots.contains(slot), text(task["work_id"], max: 200), text(task["title"], max: 500), let status = task["status"] as? String, ["pending", "done", "deleted"].contains(status), day(task["carried_from"]) || null(task["carried_from"]), (timestamp(task["start"]) && timestamp(task["end"])) || (null(task["start"]) && null(task["end"])) else { return false }
                if let rawEvidence = task["evidence"] {
                    guard let evidence = rawEvidence as? [[String: Any]], evidence.count <= 3 else { return false }
                    for item in evidence {
                        guard keys(item, required: ["ref"], optional: ["self_review"]), text(item["ref"], max: 4000), let ref = item["ref"] as? String else { return false }
                        let url = URL(string: ref)
                        guard ref.hasPrefix("/") || (url?.scheme == "https" && !(url?.host ?? "").isEmpty) else { return false }
                        if let review = item["self_review"], !text(review, max: 2000, empty: true) { return false }
                    }
                }
            }
        }
        return true
    }
}
