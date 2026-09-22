import { LegalPage } from "../legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>
        This is a placeholder terms page for the Save the Locals pilot. It has not
        been reviewed by an Indian legal professional and must not be relied on until
        it is. Do not charge customers money or launch beyond a small pilot on this
        text alone.
      </p>
      <h2>What this is</h2>
      <p>
        Save the Locals hosts an online ordering page for independent neighbourhood
        shops. Each shop, not Save the Locals, sells and delivers the goods you order,
        sets its own prices, hours, and delivery area, and is responsible for the
        order.
      </p>
      <h2>Placing an order</h2>
      <p>
        Prices and stock shown at checkout are confirmed by the shop&apos;s own system at
        the moment you place the order. An order below the shop&apos;s minimum, or for an
        item that has gone out of stock, will be refused before it is accepted.
      </p>
      <h2>Payment</h2>
      <p>Orders are paid in cash or by UPI directly to the shop on delivery or pickup.</p>
      <h2>Disputes</h2>
      <p>Any issue with an order should be raised directly with the shop first.</p>
    </LegalPage>
  );
}
