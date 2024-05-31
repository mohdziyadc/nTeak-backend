import { CartService, Order, TotalsService } from "@medusajs/medusa";

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

export async function orderPlacedData(
  order: Order,
  totalsService_: TotalsService,
  cartService_: CartService
) {
  const { tax_total, shipping_total, gift_card_total, total } = order;

  console.log("The placed order: " + JSON.stringify(order));

  const currencyCode = order.currency_code.toUpperCase();

  const items = await Promise.all(
    order.items.map(async (i: any) => {
      try {
        i.totals = await totalsService_.getLineItemTotals(i, order, {
          include_tax: true,
          use_tax_lines: true,
        });
        i.thumbnail = normalizeThumbUrl_(i.thumbnail);
        i.discounted_price = `${humanPrice_(
          i.totals.total / i.quantity,
          currencyCode
        )} ${currencyCode}`;
        i.price = `${humanPrice_(
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

  const locale = await extractLocale(order, cartService_);

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
    subtotal_ex_tax: `${humanPrice_(
      subtotal_ex_tax,
      currencyCode
    )} ${currencyCode}`,
    subtotal: `${humanPrice_(subtotal, currencyCode)} ${currencyCode}`,
    gift_card_total: `${humanPrice_(
      gift_card_total,
      currencyCode
    )} ${currencyCode}`,
    tax_total: `${humanPrice_(tax_total, currencyCode)} ${currencyCode}`,
    discount_total: `${humanPrice_(
      discountTotal,
      currencyCode
    )} ${currencyCode}`,
    shipping_total: `${humanPrice_(
      shipping_total,
      currencyCode
    )} ${currencyCode}`,
    total: `${humanPrice_(total, currencyCode)} ${currencyCode}`,
  };
}

async function humanPrice_(amount, currency) {
  if (!amount) {
    return "0.00";
  }

  const normalized = humanizeAmount(amount, currency);
  return normalized.toFixed(
    zeroDecimalCurrencies.includes(currency.toLowerCase()) ? 0 : 2
  );
}

const humanizeAmount = (amount: number, currency: string): number => {
  let divisor = 100;

  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    divisor = 1;
  }

  return amount / divisor;
};

async function normalizeThumbUrl_(url) {
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

async function extractLocale(fromOrder, cartService_: CartService) {
  if (fromOrder.cart_id) {
    try {
      const cart = await cartService_.retrieve(fromOrder.cart_id, {
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
