import Foundation
import EventKit

// EventKit uses the Mac's existing account sync; Panda never stores Google credentials.
final class CalendarReader {
    private lazy var store = EKEventStore()
    var selectedIDs: () -> [String] = { [] }
    var isConnected: () -> Bool = { false }
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
        if EKEventStore.authorizationStatus(for: .event) == .fullAccess { refresh(); return }
        store.requestFullAccessToEvents { [weak self] _, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let error { self.publish("calendarInfo", ["status":"error", "message":error.localizedDescription, "calendars":[]] as [String:Any]) }
                else { self.refresh() }
            }
        }
    }
    func refresh() {
        let auth = EKEventStore.authorizationStatus(for: .event)
        guard auth == .fullAccess else {
            let status = auth == .denied || auth == .restricted ? "denied" : "notConnected"
            publish("calendarInfo", ["status":status,"calendars":[]] as [String:Any])
            if isConnected() { publish("calendarSnapshot", []) }
            return
        }
        let calendars = store.calendars(for: .event).sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        publish("calendarInfo", ["status":"authorized","calendars":calendars.map { ["id":$0.calendarIdentifier,"title":$0.title,"source":$0.source.title] }] as [String:Any])
        guard isConnected() else { return }
        let ids = Set(selectedIDs())
        let chosen = calendars.filter { ids.contains($0.calendarIdentifier) }
        guard !chosen.isEmpty else { publish("calendarSnapshot", []); return }
        let now = Date()
        let start = Calendar.current.startOfDay(for: now).addingTimeInterval(-86400)
        let end = now.addingTimeInterval(7 * 86400)
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: chosen)
        var seen = Set<String>()
        let events: [[String:Any]] = store.events(matching: predicate)
            .filter { $0.endDate > now && $0.status != .canceled }
            .sorted { $0.startDate < $1.startDate }
            .prefix(1000).compactMap { event in
                let startMS = event.startDate.timeIntervalSince1970 * 1000
                let id = "\(event.calendar.calendarIdentifier):\(event.calendarItemIdentifier):\(Int(startMS))"
                guard seen.insert(id).inserted else { return nil }
                let title = (event.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                return ["id":id,"title":String((title.isEmpty ? "Untitled event" : title).prefix(500)),"start":startMS,"end":event.endDate.timeIntervalSince1970 * 1000,"allDay":event.isAllDay,"calendarLabel":event.calendar.title]
            }
        publish("calendarSnapshot", events)
    }
}
