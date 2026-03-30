import IdentityLookup
import Foundation

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {

    func handle(
        _ queryRequest: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        // Extension çalıştı — shared container'a yaz (ana uygulama okuyacak)
        let sharedDefaults = UserDefaults(suiteName: "group.com.smscleaner")
        sharedDefaults?.set(true, forKey: "extension_did_run")
        sharedDefaults?.set(Date().timeIntervalSince1970, forKey: "extension_last_run")
        sharedDefaults?.synchronize()

        let response = ILMessageFilterQueryResponse()

        guard let sender = queryRequest.sender else {
            response.action = .none
            completion(response)
            return
        }

        response.action = SpamAnalyzer.analyze(sender: sender)
        completion(response)
    }
}

// MARK: - Spam Analyzer
enum SpamAnalyzer {
    static func analyze(sender: String) -> ILMessageFilterAction {
        let s = sender.trimmingCharacters(in: .whitespacesAndNewlines)

        // Uluslararası format (+90...) → geçir
        if s.hasPrefix("+") { return .none }

        let digits = s.filter { $0.isNumber }

        // 850 ile başlayanlar
        if digits.hasPrefix("850") || digits.hasPrefix("90850") {
            return .filter
        }

        // Sadece rakam içeren gönderici
        if s.allSatisfy({ $0.isNumber }) {
            if isRepeating(s) || isSequential(s) { return .filter }
            if s.count >= 4 && s.count <= 6 { return .junk }
            return .filter
        }

        return .none
    }

    private static func isRepeating(_ s: String) -> Bool {
        guard s.count >= 4, let first = s.first else { return false }
        return s.allSatisfy { $0 == first }
    }

    private static func isSequential(_ s: String) -> Bool {
        guard s.count >= 4 else { return false }
        let d = s.compactMap { $0.wholeNumberValue }
        guard d.count == s.count else { return false }
        let asc  = zip(d, d.dropFirst()).allSatisfy { $1 - $0 == 1 }
        let desc = zip(d, d.dropFirst()).allSatisfy { $0 - $1 == 1 }
        return asc || desc
    }
}
