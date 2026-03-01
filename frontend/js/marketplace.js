document.addEventListener("DOMContentLoaded", initMarketplace);

let allArtworks = []; // store all artworks globally for client-side filtering

/* ================= INIT ================= */

async function initMarketplace() {
  await setupNavbar();
  await loadCartCount();
  await loadArtworks();
  setupFilters();
  setupLogout();
}

/* ================= LOGOUT FIX ================= */

function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "login.html";
    });
  }
}

/* ================= AUTH / NAVBAR ================= */

async function setupNavbar() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  const homeLink = document.querySelector(".nav-home");
  if (!user || !homeLink) return;

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
  const { data, error } = await supabase.from("artworks").select("*");

  if (error) {
    console.error(error);
    return;
  }

  allArtworks = data || [];
  renderArtworks(allArtworks);
}

/* ================= RENDER ARTWORKS ================= */

function renderArtworks(artworks) {
  const grid = document.getElementById("artGrid");
  const resultsCount = document.getElementById("resultsCount");

  grid.innerHTML = "";

  if (!artworks || artworks.length === 0) {
    grid.innerHTML = `<p style="color:#888; padding:20px;">No artworks found matching your filters.</p>`;
    if (resultsCount) resultsCount.textContent = "Showing 0 artworks";
    return;
  }

  if (resultsCount) {
    resultsCount.textContent = `Showing ${artworks.length} artwork${artworks.length !== 1 ? "s" : ""}`;
  }
data.forEach(art => {
  grid.innerHTML += `
    <div class="art-card">
      <div class="image-wrapper">
        <img src="${art.image_url}" alt="${art.title}" onerror="this.src='https://via.placeholder.com/300x240?text=No+Image'" />
        <button class="wishlist-btn" data-id="${art.id}">🤍</button>
      </div>
      <div class="art-content">
        <span class="category-tag">${art.category || 'Art'}</span>
        <div class="art-title">${art.title}</div>
        <div class="art-artist">by ${art.artist_name || 'Unknown Artist'}</div>
        <div class="art-footer">
          <span class="price">₹${Number(art.price).toLocaleString("en-IN")}</span>
          <button class="add-cart-btn" data-id="${art.id}">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
});
}

function setupFilters() {
  const searchInput = document.getElementById("searchInput");
  const categorySelect = document.getElementById("categorySelect");
  const priceRange = document.getElementById("priceRange");
  const priceValue = document.getElementById("priceValue");
  const priceMinus = document.getElementById("priceMinus");
  const pricePlus = document.getElementById("pricePlus");

  function applyFilters() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedCategory = categorySelect ? categorySelect.value : "all";
    const maxPrice = priceRange ? parseInt(priceRange.value) : 20000;

    // Update price display
    if (priceValue) {
      priceValue.textContent = "₹" + maxPrice.toLocaleString("en-IN");
    }

    const filtered = allArtworks.filter((art) => {
      const price = Number(art.price);
      const matchesPrice = price <= maxPrice;

      const matchesCategory =
        selectedCategory === "all" ||
        (art.category || "").toLowerCase() === selectedCategory.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        (art.title || "").toLowerCase().includes(searchTerm) ||
        (art.artist_name || "").toLowerCase().includes(searchTerm) ||
        (art.category || "").toLowerCase().includes(searchTerm);

      return matchesPrice && matchesCategory && matchesSearch;
    });

    renderArtworks(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (categorySelect) categorySelect.addEventListener("change", applyFilters);

  if (priceRange) {
    priceRange.addEventListener("input", applyFilters);

    // Initialise display on load
    if (priceValue) {
      priceValue.textContent =
        "₹" + parseInt(priceRange.value).toLocaleString("en-IN");
    }
  }

  if (priceMinus) {
    priceMinus.addEventListener("click", () => {
      const step = parseInt(priceRange.step) || 500;
      const newVal = Math.max(
        parseInt(priceRange.min),
        parseInt(priceRange.value) - step
      );
      priceRange.value = newVal;
      applyFilters();
    });
  }

  if (pricePlus) {
    pricePlus.addEventListener("click", () => {
      const step = parseInt(priceRange.step) || 500;
      const newVal = Math.min(
        parseInt(priceRange.max),
        parseInt(priceRange.value) + step
      );
      priceRange.value = newVal;
      applyFilters();
    });
  }
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
    window.location.href = "login.html";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Adding...";

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
    await supabase.from("cart").insert({
      user_id: user.id,
      artwork_id: artworkId,
      quantity: 1,
    });
  }

  await loadCartCount();
  btn.disabled = false;
  btn.textContent = "✓ Added!";
  setTimeout(() => {
    btn.textContent = "Add to Cart";
  }, 1500);
});