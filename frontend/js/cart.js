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

  let subtotal = 0;

  data.forEach(item => {

    const art = item.artworks;
    const itemTotal = art.price * item.quantity;
    subtotal += itemTotal;

    container.innerHTML += `
      <div class="cart-card" data-id="${item.id}">
        <img src="${art.image_url}" />

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
    "₹" + gst.toLocaleString("en-IN");

  document.getElementById("total").innerText =
    "₹" + total.toLocaleString("en-IN");
}

/* ================= EVENT DELEGATION ================= */

document.addEventListener("click", async function (e) {

  const card = e.target.closest(".cart-card");
  if (!card) return;

  const cartId = card.dataset.id;

  // MINUS
  if (e.target.classList.contains("minus-btn")) {
    await changeQuantity(cartId, -1);
  }

  // PLUS
  if (e.target.classList.contains("plus-btn")) {
    await changeQuantity(cartId, +1);
  }

  // DELETE
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

  const count = data.reduce((sum, item) => sum + item.quantity, 0);

  const badge = document.getElementById("cartCount");
  if (badge) badge.innerText = count;
}
document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.querySelector(".checkout-btn");

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", startPayment);
  }
});