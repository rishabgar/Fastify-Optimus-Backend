import Fastify from "fastify";
import authModule from "./src/modules/auth/index.js";
import cartModule from "./src/modules/cart/index.js";
import couponModule from "./src/modules/coupon/index.js";
import healthModule from "./src/modules/health/index.js";
import orderModule from "./src/modules/order/index.js";
import paymentModule from "./src/modules/payment/index.js";
import rewardModule from "./src/modules/reward/index.js";
import productCategoryModule from "./src/modules/product-category/index.js";
import productModule from "./src/modules/product/index.js";
import sellerProductModule from "./src/modules/seller-product/index.js";
import shopModule from "./src/modules/shop/index.js";
import shopFavouriteModule from "./src/modules/shop-favourite/index.js";
import shopTypeModule from "./src/modules/shop-type/index.js";
import userModule from "./src/modules/user/index.js";
import mongoosePlugin from "./src/shared/database/mongoose.js";
import { registerErrorHandlers } from "./src/shared/http/error-handler.js";

export function buildApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const environment = options.environment ?? process.env.environment;
  const isProduction = options.isProduction ?? environment === "production";
  const isDevelopment = options.isDevelopment ?? environment === "development";

  registerErrorHandlers(app);

  if (options.connectDatabase ?? true) {
    app.register(mongoosePlugin, {
      uri: options.mongoUri ?? process.env.MONGODB_URI,
    });
  }

  app.register(healthModule);
  app.register(userModule, {
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    userService: options.userService,
  });
  app.register(productModule, {
    prefix: "/product",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    productService: options.productService,
  });
  app.register(sellerProductModule, {
    prefix: "/product",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    sellerProductService: options.sellerProductService,
  });
  app.register(productCategoryModule, {
    prefix: "/categories",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    productCategoryService: options.productCategoryService,
    isDevelopment,
  });
  app.register(couponModule, {
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    couponCampaignService: options.couponCampaignService,
    couponAssignmentService: options.couponAssignmentService,
    couponRedemptionService: options.couponRedemptionService,
  });
  app.register(shopModule, {
    prefix: "/shop",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    shopService: options.shopService,
    isProduction,
  });
  app.register(shopFavouriteModule, {
    prefix: "/shopFavourites",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    shopFavouriteService: options.shopFavouriteService,
  });
  app.register(shopTypeModule, {
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    shopTypeService: options.shopTypeService,
  });
  app.register(cartModule, {
    prefix: "/cart",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    cartService: options.cartService,
  });
  app.register(rewardModule);
  app.register(orderModule, {
    prefix: "/orders",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    orderService: options.orderService,
    rewardService: options.rewardService,
  });
  app.register(paymentModule, {
    prefix: "/payments",
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    paymentService: options.paymentService,
    cashfreeClient: options.cashfreeClient,
  });
  app.register(authModule, {
    prefix: "/auth",
    authService: options.authService,
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    isDevelopment,
    verifyFirebaseIdToken: options.verifyFirebaseIdToken,
    firebaseProjectId:
      options.firebaseProjectId ?? process.env.FIREBASE_PROJECT_ID,
  });

  return app;
}
