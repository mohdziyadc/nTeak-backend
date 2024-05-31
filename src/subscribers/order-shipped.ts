import { CartService, TotalsService, OrderService } from "@medusajs/medusa";
import { orderPlacedData } from "src/utils/utils";

class OrderShippedSubscriber {
  protected orderService_: OrderService;
  protected cartService_: CartService;
  protected totalsService_: TotalsService;

  constructor({
    eventBusService,
    sendgridService,
    orderService,
    totalsService,
    cartService,
  }) {
    this.totalsService_ = totalsService;
    this.orderService_ = orderService;
    this.cartService_ = cartService;

    eventBusService.subscribe(
      "order.shipment_created",
      async (data) => {
        console.log(
          "Template id from order shipped event handler: " +
            process.env.ORDER_SHIPPED_TEMPLATE
        );

        const order = await this.orderService_.retrieve(data.id, {
          select: [
            "shipping_total",
            "discount_total",
            "tax_total",
            "refunded_total",
            "gift_card_total",
            "subtotal",
            "total",
            "refundable_amount",
          ],
          relations: [
            "customer",
            "billing_address",
            "shipping_address",
            "discounts",
            "discounts.rule",
            "shipping_methods",
            "shipping_methods.shipping_option",
            "payments",
            "fulfillments",
            "returns",
            "gift_cards",
            "gift_card_transactions",
          ],
        });

        const modifiedOrder = await orderPlacedData(
          order,
          this.totalsService_,
          this.cartService_
        );

        try {
          sendgridService.sendEmail({
            templateId: process.env.ORDER_SHIPPED_TEMPLATE,
            from: {
              email: process.env.SENDGRID_FROM,
              name: "Nilambur Teak",
            },
            to: modifiedOrder.email,
            dynamic_template_data: {
              ...modifiedOrder,
            },
          });
          console.log("Sendgrid Success " + JSON.stringify("Bruh"));
        } catch (e) {
          console.log("Sendgrid Error " + JSON.stringify(e));
        }
      },
      {
        subscriberId: "order-shipped-subscriber",
      }
    );
  }
}

export default OrderShippedSubscriber;
