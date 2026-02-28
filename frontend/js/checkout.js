async function startPayment() {

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    alert("Please login first");
    return;
  }

  // 1️⃣ Get cart with artworks
  const { data: cartItems, error } = await supabase
    .from("cart")
    .select(`
      id,
      quantity,
      artworks (
        id,
        price,
        artist_id
      )
    `)
    .eq("user_id", user.id);

  if (error || !cartItems.length) {
    alert("Cart is empty");
    return;
  }

  // 2️⃣ Calculate totals
  let subtotal = 0;

  cartItems.forEach(item => {
    subtotal += item.artworks.price * item.quantity;
  });

  const gst = subtotal * 0.18;
  const total = Math.round(subtotal + gst);

  // 3️⃣ Create Razorpay order from backend
  const response = await fetch("http://localhost:5000/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: total })
  });

  const razorpayOrder = await response.json();

  // 4️⃣ Razorpay options
  const options = {
    key: "YOUR_RAZORPAY_KEY",
    amount: razorpayOrder.amount,
    currency: "INR",
    order_id: razorpayOrder.id,

    handler: async function (response) {

      // 5️⃣ Verify payment
      await fetch("http://localhost:5000/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response)
      });

      // 6️⃣ Insert order in Supabase
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          buyer_id: user.id,
          total_amount: total,
          status: "paid"
        })
        .select()
        .single();

      if (orderError) {
        alert("Order storage failed");
        console.error(orderError);
        return;
      }

      const orderId = orderData.id;

      // 7️⃣ Insert order_items
      const orderItems = cartItems.map(item => ({
        order_id: orderId,
        artwork_id: item.artworks.id,
        artist_id: item.artworks.artist_id,
        price: item.artworks.price,
        quantity: item.quantity
      }));

      await supabase.from("order_items").insert(orderItems);

      // 8️⃣ Clear cart
      await supabase
        .from("cart")
        .delete()
        .eq("user_id", user.id);

      alert("Payment Successful!");
      window.location.href = "marketplace.html";
    }
  };

  new Razorpay(options).open();
}