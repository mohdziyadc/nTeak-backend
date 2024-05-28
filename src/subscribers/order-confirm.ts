import {
  CartService,
  Order,
  OrderService,
  TotalsService,
} from "@medusajs/medusa";
const zeroDecimalCurrencies = [
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
];
class OrderConfirmSubscriber {
  protected orderService_: OrderService;
  protected totalsService_: TotalsService;
  protected cartService_: CartService;

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
      "order.placed",
      async (data) => {
        console.log(
          "Template id from event handler: " + process.env.ORDER_PLACED_TEMPLATE
        );

        const order = await orderService.retrieve(data.id, {
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

        const modifiedOrder = await this.orderPlacedData(order);

        try {
          sendgridService.sendEmail({
            templateId: process.env.ORDER_PLACED_TEMPLATE,
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
        subscriberId: "order-placed-subscriber",
      }
    );
  }

  async orderPlacedData(order: Order) {
    const { tax_total, shipping_total, gift_card_total, total } = order;

    console.log("The placed order: " + JSON.stringify(order));

    const currencyCode = order.currency_code.toUpperCase();

    const items = await Promise.all(
      order.items.map(async (i: any) => {
        try {
          i.totals = await this.totalsService_.getLineItemTotals(i, order, {
            include_tax: true,
            use_tax_lines: true,
          });
          i.thumbnail = this.normalizeThumbUrl_(i.thumbnail);
          i.discounted_price = `${this.humanPrice_(
            i.totals.total / i.quantity,
            currencyCode
          )} ${currencyCode}`;
          i.price = `${this.humanPrice_(
            i.totals.original_total / i.quantity,
            currencyCode
          )} ${currencyCode}`;
          return i;
        } catch (e) {
          console.log(JSON.stringify(e));
        }
      })
    );

    let discounts = [];
    if (order.discounts) {
      discounts = order.discounts.map((discount) => {
        return {
          is_giftcard: false,
          code: discount.code,
          descriptor: `${discount.rule.value}${
            discount.rule.type === "percentage" ? "%" : ` ${currencyCode}`
          }`,
        };
      });
    }

    let giftCards = [];
    if (order.gift_cards) {
      giftCards = order.gift_cards.map((gc) => {
        return {
          is_giftcard: true,
          code: gc.code,
          descriptor: `${gc.value} ${currencyCode}`,
        };
      });

      discounts.concat(giftCards);
    }

    const locale = await this.extractLocale(order);

    // Includes taxes in discount amount
    const discountTotal = items.reduce((acc, i) => {
      return acc + i.totals.original_total - i.totals.total;
    }, 0);

    const discounted_subtotal = items.reduce((acc, i) => {
      return acc + i.totals.total;
    }, 0);
    const subtotal = items.reduce((acc, i) => {
      return acc + i.totals.original_total;
    }, 0);

    const subtotal_ex_tax = items.reduce((total, i) => {
      return total + i.totals.subtotal;
    }, 0);

    return {
      ...order,
      locale,
      has_discounts: order.discounts.length,
      has_gift_cards: order.gift_cards.length,
      date: order.created_at.toDateString(),
      items,
      discounts,
      subtotal_ex_tax: `${this.humanPrice_(
        subtotal_ex_tax,
        currencyCode
      )} ${currencyCode}`,
      subtotal: `${this.humanPrice_(subtotal, currencyCode)} ${currencyCode}`,
      gift_card_total: `${this.humanPrice_(
        gift_card_total,
        currencyCode
      )} ${currencyCode}`,
      tax_total: `${this.humanPrice_(tax_total, currencyCode)} ${currencyCode}`,
      discount_total: `${this.humanPrice_(
        discountTotal,
        currencyCode
      )} ${currencyCode}`,
      shipping_total: `${this.humanPrice_(
        shipping_total,
        currencyCode
      )} ${currencyCode}`,
      total: `${this.humanPrice_(total, currencyCode)} ${currencyCode}`,
    };
  }

  humanPrice_(amount, currency) {
    if (!amount) {
      return "0.00";
    }

    const normalized = this.humanizeAmount(amount, currency);
    return normalized.toFixed(
      zeroDecimalCurrencies.includes(currency.toLowerCase()) ? 0 : 2
    );
  }

  humanizeAmount = (amount: number, currency: string): number => {
    let divisor = 100;

    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      divisor = 1;
    }

    return amount / divisor;
  };

  normalizeThumbUrl_(url) {
    if (!url) {
      return null;
    }

    if (url.startsWith("http")) {
      return url;
    } else if (url.startsWith("//")) {
      return `https:${url}`;
    }
    return url;
  }

  async extractLocale(fromOrder) {
    if (fromOrder.cart_id) {
      try {
        const cart = await this.cartService_.retrieve(fromOrder.cart_id, {
          select: ["id", "context"],
        });

        if (cart.context && cart.context.locale) {
          return cart.context.locale;
        }
      } catch (err) {
        console.log(err);
        console.warn("Failed to gather context for order");
        return null;
      }
    }
    return null;
  }
}

export default OrderConfirmSubscriber;
