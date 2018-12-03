import { ApolloClient } from "apollo-client";
import { ApolloLink } from "apollo-link";
import { Router } from "routes";
import { HttpLink } from "apollo-link-http";
import { setContext } from "apollo-link-context";
import { onError } from "apollo-link-error";
import { InMemoryCache } from "apollo-cache-inmemory";
import fetch from "isomorphic-fetch";
import getConfig from "next/config";
import { omitTypenameLink } from "../apollo/omitVariableTypenameLink";

// Config
let searchGraphqlUrl;

const { publicRuntimeConfig, serverRuntimeConfig } = getConfig();

/* eslint-disable prefer-destructuring */
if (process.browser) {
  searchGraphqlUrl = publicRuntimeConfig.searchGraphqlUrl;
} else {
  searchGraphqlUrl = serverRuntimeConfig.searchGraphqlUrl;
}
/* eslint-enable prefer-destructuring */


let apolloClient = null;

if (!process.browser) {
  global.fetch = fetch;
}

const create = (initialState, options) => {
  // error handling for Apollo Link
  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        // eslint-disable-next-line no-console
        console.error(`[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${JSON.stringify(path)}`);
      });
    }

    if (networkError) {
      const errorCode = networkError.response && networkError.response.status;
      // In browser, if a 401 Unauthorized error occurred, redirect to /signin.
      // This will re-authenticate the user without showing a login page and a new token is issued.
      if (errorCode === 401) {
        if (process && process.browser) Router.pushRoute("/signin");
      }

      // eslint-disable-next-line no-console
      console.error(`[Network error]: ${networkError}`);
    }
  });

  // let authorizationHeader = {};
  // if (options.accessToken) {
  //   authorizationHeader = { Authorization: options.accessToken };
  // }

  // Set auth context
  // https://github.com/apollographql/apollo-link/tree/master/packages/apollo-link-context
  // const authLink = setContext((__, { headers }) => ({
  //   headers: {
  //     ...headers,
  //     ...authorizationHeader
  //   }
  // }));

  const httpLink = new HttpLink({ uri: `${searchGraphqlUrl}`, credentials: "same-origin" });
  console.log("HEY create() returning an apollo client", searchGraphqlUrl); // fixme
  const ac = new ApolloClient({
    connectToDevTools: process.browser,
    ssrMode: !process.browser,
    // link: ApolloLink.from([omitTypenameLink, authLink, errorLink, httpLink]),
    link: ApolloLink.from([omitTypenameLink, errorLink, httpLink]),
    cache: new InMemoryCache().restore(initialState || {})
  });
  console.log("HEY ApolloClient", ac); // fixme
  return ac;
};

/**
 * @name initApollo
 * @param {Object} initialState Initial state to initialize the Apollo client with
 * @param {Object} options Additional options to initialize the Apollo client with
 * @return {ApolloClient} Apollo client instance
 */
export default function initApollo(initialState, options) {
  console.log("HEY initApollo()"); // fixme
  // Make sure to create a new client for every server-side request so that data
  // isn't shared between connections (which would be bad)
  if (!process.browser) {
    return create(initialState, options);
  }

  if (!apolloClient) {
    apolloClient = create(initialState, options);
  }

  return apolloClient;
}