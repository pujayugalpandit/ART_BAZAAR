const BACKEND_URL = "https://art-bazaar-4nm8.onrender.com";
const RAZORPAY_KEY_ID = "rzp_test_SLsnMoiJyraWIJ";

let cartData = null;
let userInfo = null;

document.addEventListener("DOMContentLoaded", initCheckout);

async function initCheckout() {
  console.log("🔄 Initializing checkout page...");

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    console.log("❌ No user session, redirecting to login");
    window.location.href = "login.html";
    return;
  }

  console.log("✅ User authenticated:", user.email);

  await loadCheckoutCart(user.id);

  const emailInput = document.getElementById("email");
  if (emailInput) {
    emailInput.value = user.email;
  }

  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", handleCheckoutSubmit);
    console.log("✅ Form listener attached");
  }
}

async function loadCheckoutCart(userId) {
  try {
    console.log("🔄 Loading cart data for user:", userId);

    const { data, error } = await supabase
      .from("cart")
      .select(`
        id,
        quantity,
        artworks (
          id,
          title,
          price,
          image_url
        )
      `)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Error loading cart:", error);
      alert("Error loading cart. Please try again.");
      return;
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ Cart is empty");
      alert("Your cart is empty!");
      window.location.href = "cart.html";
      return;
    }

    cartData = data;
    console.log("✅ Cart loaded:", data.length, "items");
    displayOrderSummary();
  } catch (err) {
    console.error("❌ Error loading cart:", err);
  }
}

function displayOrderSummary() {
  try {
    if (!cartData || cartData.length === 0) {
      console.error("❌ No cart data to display");
      return;
    }

    let subtotal = 0;
    let itemsHTML = "";

    cartData.forEach((item) => {
      const art = item.artworks;
      const itemTotal = art.price * item.quantity;
      subtotal += itemTotal;

      itemsHTML += `
        <div class="order-item">
          <img src="${art.image_url}" alt="${art.title}" onerror="this.src='placeholder.jpg'">
          <div>
            <h4>${art.title}</h4>
            <p>₹${art.price.toLocaleString("en-IN")} × ${item.quantity}</p>
          </div>
          <strong>₹${itemTotal.toLocaleString("en-IN")}</strong>
        </div>
      `;
    });

    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    console.log("💰 Totals:", { subtotal, gst, total });

    const orderItemsDiv = document.getElementById("orderItems");
    if (orderItemsDiv) orderItemsDiv.innerHTML = itemsHTML;

    const subtotalEl = document.getElementById("orderSubtotal");
    if (subtotalEl) subtotalEl.textContent = "₹" + subtotal.toLocaleString("en-IN");

    const gstEl = document.getElementById("orderGst");
    if (gstEl) gstEl.textContent = "₹" + gst.toLocaleString("en-IN");

    const totalEl = document.getElementById("orderTotal");
    if (totalEl) totalEl.textContent = "₹" + total.toLocaleString("en-IN");

    console.log("✅ Order summary displayed");
  } catch (err) {
    console.error("❌ Error displaying order summary:", err);
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  console.log("🔄 Checkout form submitted");

  try {
    userInfo = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      address: document.getElementById("address").value,
      city: document.getElementById("city").value,
      state: document.getElementById("state").value,
      pincode: document.getElementById("pincode").value,
    };

    if (
      !userInfo.name ||
      !userInfo.email ||
      !userInfo.phone ||
      !userInfo.address
    ) {
      alert("Please fill all required fields");
      return;
    }

    await startPayment();
  } catch (err) {
    console.error("❌ Form error:", err);
    alert("Error: " + err.message);
  }
}

async function startPayment() {
  try {
    console.log("🔄 Starting payment...");

    if (!cartData || cartData.length === 0) {
      alert("Cart is empty!");
      return;
    }

    let subtotal = 0;
    cartData.forEach((item) => {
      subtotal += item.artworks.price * item.quantity;
    });

    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    // FIX: Send amount in RUPEES — server.js will multiply by 100 to get paise
    const amountInRupees = parseFloat(total.toFixed(2));

    console.log("💰 Sending to backend: ₹" + amountInRupees);

    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Processing...";
    }

    const orderRes = await fetch(`${BACKEND_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountInRupees,  // RUPEES — server multiplies by 100
        currency: "INR",
        notes: {
          customer_name: userInfo.name,
          customer_email: userInfo.email,
          customer_phone: userInfo.phone,
          shipping_address: userInfo.address,
          shipping_city: userInfo.city,
          shipping_state: userInfo.state,
          shipping_pincode: userInfo.pincode,
        },
      }),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error("Backend response:", errBody);
      throw new Error(`Backend error: ${orderRes.status}`);
    }

    const orderData = await orderRes.json();
    console.log("✅ Order created:", orderData.id);

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Art Bazaar",
      description: "Artwork Purchase",
      order_id: orderData.id,
      prefill: {
        name: userInfo.name,
        email: userInfo.email,
        contact: userInfo.phone,
      },
      method: {
        upi: true,
        netbanking: false,
        card: false,
        wallet: false,
      },
      handler: async function (response) {
        console.log("✅ Payment successful!");

        try {
          const verifyRes = await fetch(`${BACKEND_URL}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const result = await verifyRes.json();
          console.log("✅ Verification:", result);

          if (result.success) {
            sessionStorage.setItem(
              "lastOrder",
              JSON.stringify({
                orderId: orderData.id,
                paymentId: response.razorpay_payment_id,
                amount: orderData.amount,
                ...userInfo,
              })
            );

            sessionStorage.setItem("paymentSuccess", "true");

            await clearUserCart();
            console.log("🔄 Redirecting to success page...");
            window.location.href = "success.html";
          } else {
            alert("Verification failed");
          }
        } catch (err) {
          console.error("Verification error:", err);
          alert("Error verifying payment");
        }
      },
      modal: {
        ondismiss: function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Proceed to Payment →";
          }
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error("❌ Payment error:", err);
    alert("Payment failed: " + err.message);

    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Proceed to Payment →";
    }
  }
}

async function clearUserCart() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (user) {
      await supabase.from("cart").delete().eq("user_id", user.id);
      console.log("✅ Cart cleared");
    }
  } catch (err) {
    console.error("Cart clear error:", err);
  }
}