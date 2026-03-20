import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  console.log("➡️ /webhooks/orders/paid route was hit! Method:", request.method);

  // Only accept POST requests
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let admin, payload, shop;
  try {
    // Authenticate the webhook request
    const auth = await authenticate.webhook(request);
    admin = auth.admin;
    payload = auth.payload;
    shop = auth.shop;
  } catch (authError) {
    console.error("🔒 Webhook authentication failed:", authError);
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }

  try {
    const customerId = payload?.customer?.id;
    const discountApplications = payload?.discount_applications || [];

    console.log(`ORDERS_PAID: Received for shop ${shop}`);

    if (!customerId) {
      console.log("ORDERS_PAID: No customer on order, skipping tag.");
      return new Response("Webhook received (no customer)", { status: 200 });
    }

    console.log(`ORDERS_PAID: Processing paid order for customer ${customerId}`);

    // Check if any discount is our exact B2B Wholesale Price discount (case-insensitive and stripped)
    const hasB2BDiscount = discountApplications.some(
      (d) => (d.title || "").trim().toLowerCase() === "b2b wholesale price"
    );

    if (!hasB2BDiscount) {
      console.log("ORDERS_PAID: No B2B Wholesale discount found, skipping tag.");
      return new Response("Webhook received (no B2B discount)", { status: 200 });
    }

    // Fetch the customer's current tags via Admin GraphQL
    const gid = `gid://shopify/Customer/${customerId}`;
    const customerRes = await admin.graphql(
      `#graphql
      query GetCustomerTags($id: ID!) {
        customer(id: $id) {
          id
          tags
        }
      }`,
      { variables: { id: gid } }
    );

    const customerJson = await customerRes.json();
    const customer = customerJson.data?.customer;

    if (!customer) {
      console.warn("ORDERS_PAID: Could not fetch customer:", gid);
      return new Response("Webhook error (could not fetch customer)", { status: 200 });
    }

    // Only add the tag if not already present
    if (customer.tags.includes("old_b2b_customer")) {
      console.log("ORDERS_PAID: Customer already has old_b2b_customer tag, skipping.");
      return new Response("Webhook received (already tagged)", { status: 200 });
    }

    const updatedTags = [...customer.tags, "old_b2b_customer"];

    await admin.graphql(
      `#graphql
      mutation UpdateCustomerTags($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer { id tags }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: gid,
            tags: updatedTags,
          },
        },
      }
    );

    console.log(`ORDERS_PAID: ✅ Added old_b2b_customer tag to customer ${customerId}`);
    return new Response("Webhook received and processed", { status: 200 });
  } catch (err) {
    console.error("ORDERS_PAID: Error processing webhook:", err);
    // Return 200 anyway so Shopify doesn't continuously retry failing logic
    return new Response("Webhook processed with internal errors", { status: 200 });
  }
};
