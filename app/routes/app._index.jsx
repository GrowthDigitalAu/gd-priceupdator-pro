import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // 1. Check if Discount Already Exists
  const checkQuery = await admin.graphql(
    `#graphql
    query checkDiscount {
      discountNodes(first: 1, query: "title:'B2B Special Price'") {
        nodes {
          id
        }
      }
    }`
  );
  const checkJson = await checkQuery.json();
  const existingDiscounts = checkJson.data?.discountNodes?.nodes || [];

  if (existingDiscounts.length === 0) {
    console.log("Auto-Creating Discount...");

    // 2. Fetch Function ID
    const functionsQuery = await admin.graphql(
      `#graphql
          query {
              shopifyFunctions(first: 25) {
                  nodes {
                      id
                      apiType
                      title
                  }
              }
          }`
    );
    const functionsJson = await functionsQuery.json();
    const functionNode = functionsJson.data?.shopifyFunctions?.nodes?.find(
      node => node.title === "gd-b2b-discount" || node.apiType === "product_discounts"
    );

    if (functionNode) {
      // 3. Create Discount
      await admin.graphql(
        `#graphql
              mutation createB2bDiscount($functionId: String!) {
                  discountAutomaticAppCreate(
                      automaticAppDiscount: {
                          title: "B2B Special Price"
                          functionId: $functionId
                          discountClasses: [PRODUCT]
                          startsAt: "2025-12-17T00:00:00Z"
                      }
                  ) {
                      automaticAppDiscount {
                          discountId
                      }
                      userErrors {
                          field
                          message
                      }
                  }
              }`,
        {
          variables: {
            functionId: functionNode.id
          }
        }
      );
      console.log("Discount Created.");
    } else {
      console.log("Function not found.");
    }
  }

  return null;
};

export default function Index() {
  return (
    <s-page heading="Welcome to Price Updater">
      <s-box paddingBlockStart="large" paddingBlockEnd="large">
        <s-section heading="Use the sidebar to access Price Update features.">
          <s-paragraph>
            This app allows you to bulk edit your product prices in your Shopify store.
          </s-paragraph>
        </s-section>
      </s-box>
    </s-page>
  );
}
