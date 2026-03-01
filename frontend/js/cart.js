document.addEventListener("DOMContentLoaded", initCart);

async function initCart() {
  await loadCart();
  await loadCartCount();
}

/* ================= LOAD CART ================= */

async function loadCart() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

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
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("cartItems");
  container.innerHTML = "";

  // ✅ Check if coming from successful payment
  const fromPayment = sessionStorage.getItem("paymentSuccess");

  if ((!data || data.length === 0) && fromPayment) {
    sessionStorage.removeItem("paymentSuccess");
    window.location.href = "marketplace.html";
    return;
  }

  // ✅ FIX: Show nice empty cart UI instead of annoying alert
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="
        text-align: center;
        padding: 60px 20px;
        background: white;
        border-radius: 16px;
        margin-bottom: 20px;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">🛒</div>
        <h2 style="color: #333; margin-bottom: 8px;">Your cart is empty</h2>
        <p style="color: #888; margin-bottom: 24px;">Looks like you haven't added any artworks yet.</p>
        <a href="marketplace.html" style="
          background: linear-gradient(90deg, #7b2ff7, #f107a3);
          color: white;
          padding: 12px 28px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
        ">Browse Artworks →</a>
      </div>
    `;

    // Hide the order summary when cart is empty
    const summary = document.querySelector(".summary");
    if (summary) summary.style.display = "none";
    return;
  }

  // Show summary if it was hidden
  const summary = document.querySelector(".summary");
  if (summary) summary.style.display = "block";

  let subtotal = 0;

  data.forEach(item => {
    const art = item.artworks;
    const itemTotal = art.price * item.quantity;
    subtotal += itemTotal;

    container.innerHTML += `
      <div class="cart-card" data-id="${item.id}">
        <img src="${art.image_url}" onerror="this.src='https://via.placeholder.com/120?text=Art'" />

        <div class="cart-details">
          <h3>${art.title}</h3>

          <div class="qty-price">
            <div class="qty">
              <button class="minus-btn">-</button>
              <span>${item.quantity}</span>
              <button class="plus-btn">+</button>
            </div>

            <div class="price">
              ₹${itemTotal.toLocaleString("en-IN")}
            </div>

            <button class="remove-btn">🗑</button>
          </div>
        </div>
      </div>
    `;
  });

  updateSummary(subtotal);
}

/* ================= UPDATE SUMMARY ================= */

function updateSummary(subtotal) {
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  document.getElementById("subtotal").innerText =
    "₹" + subtotal.toLocaleString("en-IN");

  document.getElementById("gst").innerText =
    "₹" + gst.toFixed(2);

  document.getElementById("total").innerText =
    "₹" + total.toFixed(2);
}

/* ================= EVENT DELEGATION ================= */

document.addEventListener("click", async function (e) {
  const card = e.target.closest(".cart-card");
  if (!card) return;

  const cartId = card.dataset.id;

  if (e.target.classList.contains("minus-btn")) {
    await changeQuantity(cartId, -1);
  }

  if (e.target.classList.contains("plus-btn")) {
    await changeQuantity(cartId, +1);
  }

  if (e.target.classList.contains("remove-btn")) {
    await removeItem(cartId);
  }
});

/* ================= CHANGE QUANTITY ================= */

async function changeQuantity(cartId, delta) {
  const { data } = await supabase
    .from("cart")
    .select("quantity")
    .eq("id", cartId)
    .single();

  const newQty = data.quantity + delta;

  if (newQty <= 0) {
    await removeItem(cartId);
    return;
  }

  await supabase
    .from("cart")
    .update({ quantity: newQty })
    .eq("id", cartId);

  await loadCart();
  await loadCartCount();
}

/* ================= REMOVE ITEM ================= */

async function removeItem(cartId) {
  await supabase
    .from("cart")
    .delete()
    .eq("id", cartId);

  await loadCart();
  await loadCartCount();
}

/* ================= LOAD CART COUNT ================= */

async function loadCartCount() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return;

  const { data } = await supabase
    .from("cart")
    .select("quantity")
    .eq("user_id", user.id);

  const count = data ? data.reduce((sum, item) => sum + item.quantity, 0) : 0;

  const badge = document.getElementById("cartCount");
  if (badge) badge.innerText = count;
}

/* ================= CHECKOUT BUTTON ================= */

document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.querySelector(".checkout-btn");

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "checkout.html";
    });
  }
});