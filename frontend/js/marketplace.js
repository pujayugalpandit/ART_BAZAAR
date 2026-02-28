document.addEventListener("DOMContentLoaded", initMarketplace);

/* ================= INIT ================= */

async function initMarketplace() {
  await setupAuth();
  await loadCartCount();
  await loadArtworks();
}

/* ================= AUTH ================= */

async function setupNavbar() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  const homeLink = document.querySelector(".nav-home");

  if (!user) return;

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData) return;

  if (userData.role === "artist") {
    homeLink.textContent = "Dashboard";
    homeLink.href = "dashboard.html";
  } else {
    homeLink.textContent = "Home";
    homeLink.href = "index.html";
  }
}

/* ================= CART COUNT ================= */

async function loadCartCount() {
  
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const { data } = await supabase
    .from("cart")
    .select("quantity")
    .eq("user_id", user.id);
  if (!data) return;
const totalItems = data.reduce((sum, item) => sum + item.quantity, 0);

  const badge = document.getElementById("cartCount");
  if (badge) badge.innerText = totalItems;
}

/* ================= LOAD ARTWORKS ================= */

async function loadArtworks() {

  const { data, error } = await supabase
    .from("artworks")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  const grid = document.getElementById("artGrid");
  grid.innerHTML = "";

  data.forEach(art => {
    grid.innerHTML += `
      <div class="art-card">
        <img src="${art.image_url}" />
        <h3>${art.title}</h3>
        <p>₹${Number(art.price).toLocaleString("en-IN")}</p>
        <button class="add-cart-btn" data-id="${art.id}">
          Add to Cart
        </button>
      </div>
    `;
  });
}

/* ================= ADD TO CART (EVENT DELEGATION) ================= */

document.addEventListener("click", async function (e) {

  const btn = e.target.closest(".add-cart-btn");
  if (!btn) return;

  const artworkId = btn.dataset.id;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    alert("Please login first");
    return;
  }

  // Check existing item
  const { data: existing } = await supabase
    .from("cart")
    .select("*")
    .eq("user_id", user.id)
    .eq("artwork_id", artworkId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("cart")
      .update({ quantity: existing.quantity + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("cart")
      .insert({
        user_id: user.id,
        artwork_id: artworkId,
        quantity: 1
      });
  }

  await loadCartCount();
  alert("Added to cart!");
});
document.addEventListener("DOMContentLoaded", () => {
  loadArtworks();
  loadCartCount();
  setupNavbar();
});