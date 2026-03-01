const BACKEND_URL = "https://art-bazaar-4nm8.onrender.com";
const RAZORPAY_KEY_ID = "rzp_test_SLsnMoiJyraWIJ";

let cartData = null;
let userInfo = null;

/* ══ TOAST — replaces ALL alert() popups ══ */
function showToast(message, type = "info") {
  const existing = document.getElementById("_toast");
  if (existing) existing.remove();

  const colors = {
    info:    { bg: "#1a1a2e", border: "#7b2ff7", icon: "ℹ️" },
    success: { bg: "#0d2e1a", border: "#22c55e", icon: "✅" },
    error:   { bg: "#2e0d0d", border: "#ef4444", icon: "❌" },
    warning: { bg: "#2e1e0d", border: "#f59e0b", icon: "⚠️" },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement("div");
  toast.id = "_toast";
  toast.innerHTML = `<span style="font-size:16px">${c.icon}</span> ${message}`;

  Object.assign(toast.style, {
    position: "fixed", bottom: "28px", left: "50%",
    transform: "translateX(-50%) translateY(80px)",
    background: c.bg, color: "#fff",
    border: `1.5px solid ${c.border}`,
    padding: "14px 24px", borderRadius: "12px",
    fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: "600",
    zIndex: "9999", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    transition: "transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.35s ease",
    opacity: "0", display: "flex", alignItems: "center", gap: "10px",
    maxWidth: "420px", whiteSpace: "nowrap",
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
    toast.style.opacity = "1";
  });
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(80px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ══ INIT ══ */
document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.querySelector(".checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "checkout.html";
    });
  }
  initCheckout();
});

async function initCheckout() {
  if (!document.getElementById("checkout-form")) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) { window.location.href = "login.html"; return; }

  await loadCheckoutCart(user.id);

  const emailInput = document.getElementById("email");
  if (emailInput) emailInput.value = user.email;

  const form = document.getElementById("checkout-form");
  if (form) form.addEventListener("submit", handleCheckoutSubmit);
}

/* ══ LOAD CART ══ */
async function loadCheckoutCart(userId) {
  try {
    const { data, error } = await supabase
      .from("cart")
      .select(`id, quantity, artworks (id, title, price, image_url)`)
      .eq("user_id", userId);

    if (error) {
      showToast("Could not load your cart. Please try again.", "error");
      return;
    }

    if (!data || data.length === 0) {
      // ✅ Silent redirect — NO popup
      window.location.href = "cart.html";
      return;
    }

    cartData = data;
    displayOrderSummary();
  } catch (err) {
    showToast("Something went wrong. Please refresh.", "error");
  }
}

/* ══ ORDER SUMMARY ══ */
function displayOrderSummary() {
  if (!cartData || cartData.length === 0) return;

  let subtotal = 0;
  let itemsHTML = "";

  cartData.forEach((item) => {
    const art = item.artworks;
    const itemTotal = art.price * item.quantity;
    subtotal += itemTotal;
    itemsHTML += `
      <div class="order-item">
        <img src="${art.image_url}" alt="${art.title}"
             onerror="this.src='https://via.placeholder.com/64?text=Art'">
        <div>
          <h4>${art.title}</h4>
          <p>₹${art.price.toLocaleString("en-IN")} × ${item.quantity}</p>
        </div>
        <strong>₹${itemTotal.toLocaleString("en-IN")}</strong>
      </div>`;
  });

  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  const orderItemsDiv = document.getElementById("orderItems");
  if (orderItemsDiv) orderItemsDiv.innerHTML = itemsHTML;

  const subtotalEl = document.getElementById("orderSubtotal");
  if (subtotalEl) subtotalEl.textContent = "₹" + subtotal.toLocaleString("en-IN");

  const gstEl = document.getElementById("orderGst");
  if (gstEl) gstEl.textContent = "₹" + gst.toLocaleString("en-IN");

  const totalEl = document.getElementById("orderTotal");
  if (totalEl) totalEl.textContent = "₹" + total.toLocaleString("en-IN");
}

/* ══ FORM SUBMIT ══ */
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  userInfo = {
    name:    document.getElementById("name").value,
    email:   document.getElementById("email").value,
    phone:   document.getElementById("phone").value,
    address: document.getElementById("address").value,
    city:    document.getElementById("city").value,
    state:   document.getElementById("state").value,
    pincode: document.getElementById("pincode").value,
  };

  if (!userInfo.name || !userInfo.email || !userInfo.phone || !userInfo.address) {
    // ✅ Toast instead of alert
    showToast("Please fill in all required fields.", "warning");
    return;
  }

  try {
    await startPayment();
  } catch (err) {
    showToast("Something went wrong: " + err.message, "error");
  }
}

/* ══ PAYMENT ══ */
async function startPayment() {
  if (!cartData || cartData.length === 0) {
    window.location.href = "cart.html";
    return;
  }

  let subtotal = 0;
  cartData.forEach((item) => { subtotal += item.artworks.price * item.quantity; });
  const total = subtotal + subtotal * 0.18;
  const amountInRupees = parseFloat(total.toFixed(2));

  const submitBtn = document.querySelector(".pay-btn");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "⏳ Processing..."; }

  try {
    const orderRes = await fetch(`${BACKEND_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountInRupees, currency: "INR",
        notes: {
          customer_name: userInfo.name, customer_email: userInfo.email,
          customer_phone: userInfo.phone, shipping_address: userInfo.address,
          shipping_city: userInfo.city, shipping_state: userInfo.state,
          shipping_pincode: userInfo.pincode,
        },
      }),
    });

    if (!orderRes.ok) throw new Error(`Backend error: ${orderRes.status}`);

    const orderData = await orderRes.json();

    const options = {
      key: RAZORPAY_KEY_ID, amount: orderData.amount, currency: orderData.currency,
      name: "Art Bazaar", description: "Artwork Purchase", order_id: orderData.id,
      prefill: { name: userInfo.name, email: userInfo.email, contact: userInfo.phone },
      method: { upi: true, netbanking: false, card: false, wallet: false },
      handler: async function (response) {
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
          if (result.success) {
            sessionStorage.setItem("lastOrder", JSON.stringify({
              orderId: orderData.id, paymentId: response.razorpay_payment_id,
              amount: orderData.amount, ...userInfo,
            }));
            sessionStorage.setItem("paymentSuccess", "true");
            await clearUserCart();
            window.location.href = "success.html";
          } else {
            // ✅ Toast instead of alert
            showToast("Payment verification failed. Contact support.", "error");
          }
        } catch (err) {
          showToast("Error verifying payment. Please contact support.", "error");
        }
      },
      modal: {
        ondismiss: function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "🔒 Proceed to Payment"; }
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    // ✅ Toast instead of alert
    showToast("Payment failed: " + err.message, "error");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "🔒 Proceed to Payment"; }
  }
}

/* ══ CLEAR CART ══ */
async function clearUserCart() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (user) await supabase.from("cart").delete().eq("user_id", user.id);
  } catch (err) {
    console.error("Cart clear error:", err);
  }
}