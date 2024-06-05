const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {}

// CORS when consuming Medusa from admin
const ADMIN_CORS =
  process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";

// CORS to avoid issues when consuming Medusa from a client
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/medusa-starter-default";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

console.log("Template Id email: " + process.env.ORDER_PLACED_TEMPLATE);

const plugins = [
  `medusa-fulfillment-manual`,
  `medusa-payment-manual`,
  {
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      autoRebuild: true,
      develop: {
        open: process.env.OPEN_BROWSER !== "false",
      },
    },
  },
  {
    resolve: "medusa-payment-stripe",
    options: {
      api_key: process.env.STRIPE_SECRET_KEY,
      // webhook_secret: '',
      capture: true,
      automatic_payment_methods: true,
    },
  },
  {
    resolve: "medusa-plugin-sendgrid",
    options: {
      api_key: process.env.SENDGRID_API_KEY,
      from: process.env.SENDGRID_FROM,
      signup_success_template: process.env.SENDGRID_SIGN_UP_SUCCESS_ID,
      order_placed_template: process.env.ORDER_PLACED_TEMPLATE,
    },
  },
  {
    resolve: `medusa-file-s3`,
    options: {
      s3_url: process.env.S3_BUCKET_URL,
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.S3_BUCKET_REGION,
      access_key_id: process.env.S3_ACCESS_KEY,
      secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
  {
    resolve: "medusa-plugin-algolia",
    options: {
      applicationId: process.env.ALGOLIA_APP_ID,
      adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
      settings: {
        products: {
          indexSettings: {
            searchableAttributes: ["title", "description"],
            attributesToRetrieve: [
              "id",
              "title",
              "description",
              "handle",
              "thumbnail",
              "variants",
              "variant_sku",
              "options",
              "collection_title",
              "collection_handle",
              "images",
            ],
          },
          transformer: (product) => ({
            objectID: product.id,
            title: product.title,
            handle: product.handle,
            thumbnail: product.thumbnail,
            // other attributes...
          }),
        },
      },
    },
  },
];

//Need to send an email in the subscriber to cart.customer_updated event

const modules = {
  eventBus: {
    resolve: "@medusajs/event-bus-redis",
    options: {
      redisUrl: REDIS_URL,
    },
  },

  cacheService: {
    resolve: "@medusajs/cache-redis",
    options: {
      redisUrl: REDIS_URL,
      ttl: 30,
    },
  },
};

/** @type {import('@medusajs/medusa').ConfigModule["projectConfig"]} */
const projectConfig = {
  jwtSecret: process.env.JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET,
  store_cors: STORE_CORS,
  database_url: DATABASE_URL,
  admin_cors: ADMIN_CORS,
  // Uncomment the following lines to enable REDIS
  redis_url: REDIS_URL,
};

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig,
  plugins,
  modules,
};
