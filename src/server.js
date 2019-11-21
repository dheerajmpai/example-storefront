if (process.env.ENABLE_HONEYCOMB_INSTRUMENTATION && (process.env.ENABLE_HONEYCOMB_INSTRUMENTATION === "true")) {
  require("honeycomb-beeline")({
    writeKey: process.env.HONEYCOMB_WRITE_KEY,
    dataset: process.env.HONEYCOMB_DATASET
  });
}

const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const express = require("express");
const compression = require("compression");
const nextApp = require("next");
const { useStaticRendering } = require("mobx-react");
const config = require("./config");
const logger = require("./lib/logger");
const router = require("./routes");
const { configureAuthForServer } = require("./serverAuth");
const { sitemapRoutesHandler } = require("./sitemapRoutesHandler");

if (config.isDev) {
  logger.info("Running NextJS server in development mode...");
}

// First create the NextJS app.
// Note that only `config` can be used here because the NextJS `getConfig()` does not
// return anything until after the NextJS app is initialized.
const app = nextApp({
  dev: config.isDev,
  dir: "./src"
});

useStaticRendering(true);

app
  .prepare()
  .then(() => {
    const server = express();

    server.use(compression());

    // We use a client-side cookie session instead of a server session so that there are no
    // issues when load balancing without sticky sessions.
    // https://www.npmjs.com/package/cookie-session
    server.use(cookieSession({
      // https://www.npmjs.com/package/cookie-session#options
      keys: [config.SESSION_SECRET],
      maxAge: config.SESSION_MAX_AGE_MS,
      name: "storefront-session"
    }));
    server.use(cookieParser());

    configureAuthForServer(server);

    // add graphiql redirects to EXTERNAL_GRAPHQL_URL
    server.get(["/graphiql", "/graphql-beta", "/graphql-alpha", "/graphql"], (req, res) => {
      res.redirect(301, config.EXTERNAL_GRAPHQL_URL);
    });

    // apply to routes starting with "/sitemap" and ending with ".xml"
    server.use(/^\/sitemap.*\.xml$/, sitemapRoutesHandler);

    // Setup next routes
    const routeHandler = router.getRequestHandler(app);
    server.use(routeHandler);

    return server.listen(config.PORT, (err) => {
      if (err) throw err;
      logger.appStarted("localhost", config.PORT);
    });
  })
  .catch((ex) => {
    logger.error(ex.stack);
    process.exit(1);
  });

module.exports = app;
