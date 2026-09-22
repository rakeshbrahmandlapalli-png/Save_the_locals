import { LegalPage } from "../legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice">
      <p>
        This is a placeholder privacy notice for the Save the Locals pilot. It has not
        been reviewed by an Indian legal professional and must not be relied on until
        it is. Do not charge customers money or launch beyond a small pilot on this
        text alone.
      </p>
      <h2>What we collect</h2>
      <p>
        When you place an order we store your name, mobile number, delivery address
        (if applicable), and the items you ordered, against the shop you ordered from.
        We also record how you reached the shop&apos;s page (for example, a pamphlet or a
        QR code) so the shop can tell which of its own marketing worked.
      </p>
      <h2>How it is used</h2>
      <p>
        Your details are used only to take, confirm, and deliver your order, and to
        let you repeat a previous order without re-entering it. They are visible only
        to the staff of the shop you ordered from.
      </p>
      <h2>What we do not do</h2>
      <p>
        We do not sell your data, and we do not share it with any other shop on this
        platform. Each shop&apos;s customers are kept separate from every other shop&apos;s.
      </p>
      <h2>Contact</h2>
      <p>To ask about or remove your data, contact the shop directly.</p>
    </LegalPage>
  );
}
