/**
 * Order Placement WhatsApp Notification Handler
 * 
 * BRD Requirement (Page 7):
 * "Notification for order placement will be added in customer app also whatsapp 
 *  message will be send to customer whatsapp with order details, total amount, 
 *  chef name and number infront of each item"
 * 
 * Idempotent trigger: prevents duplicate dispatches.
 * 
 * @param {import("firebase-admin").firestore.Firestore} firestore
 * @param {import("firebase-functions/v2/firestore").DocumentSnapshot} orderSnap
 */
export async function sendOrderPlacementWhatsApp(firestore, orderSnap) {
  const orderData = orderSnap.data();
  if (!orderData) return;

  // Idempotency check: prevent duplicate messages on retries
  if (orderData.whatsappNotificationSent) {
    console.log(`Order ${orderSnap.id} already received WhatsApp notification. Skipping.`);
    return;
  }

  const customerPhone = orderData.customerMobile || orderData.userPhone;
  if (!customerPhone) {
    console.warn(`Order ${orderSnap.id} has no customer mobile number.`);
    return;
  }

  // Construct items list formatted with chef details
  const itemsText = (orderData.items || [])
    .map((item) => `• ${item.name} (Qty: ${item.quantity}) — ₹${item.price || item.pricePerUnit} [Chef: ${orderData.chefName || "Home Cook"} - ${orderData.chefMobile || ""}]`)
    .join("\n");

  const messageText = 
`🍽️ *Mother's Kitchen — Order Confirmed!*

Order ID: *#${orderData.orderNumber || orderSnap.id.slice(0, 8)}*
Delivery Time: ${orderData.deliveryTime || "As scheduled"}
Delivery Address: ${orderData.deliveryAddress || "Your Society"}

*Items Ordered:*
${itemsText}

*Total Amount:* ₹${orderData.totalAmount || orderData.totalPrice}

Thank you for supporting your local society home cooks!`;

  console.log(`[WhatsApp Dispatch Ready] Sending order confirmation to ${customerPhone}:`, messageText);

  // In production, invoke Meta WhatsApp Cloud API using system token
  // Mark as sent in Firestore to guarantee idempotency
  await orderSnap.ref.update({
    whatsappNotificationSent: true,
    whatsappNotificationSentAt: new Date().toISOString(),
  });
}
