import { LegalPage } from "../legal-page";

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund and cancellation policy">
      <p>
        This is a placeholder refund and cancellation policy for the Save the Locals
        pilot. It has not been reviewed by an Indian legal professional and must not
        be relied on until it is. Do not charge customers money or launch beyond a
        small pilot on this text alone.
      </p>
      <h2>Cancellations</h2>
      <p>
        Contact the shop directly as soon as possible if you need to cancel an order.
        Once a shop has started packing or preparing your order, it may not be
        possible to cancel it.
      </p>
      <h2>Refunds</h2>
      <p>
        Because payment is made in cash or by UPI directly to the shop on delivery or
        pickup, no advance payment is taken and there is nothing to refund before an
        order is fulfilled. If an item you ordered is unavailable, the shop will tell
        you before delivery and adjust your order and total accordingly.
      </p>
      <h2>Problems with a delivered order</h2>
      <p>Raise any problem with a delivered order directly with the shop.</p>
    </LegalPage>
  );
}
