document.addEventListener("DOMContentLoaded", async () => {

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  /* ── ROLE CHECK ── */
  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role, full_name")       
    .eq("id", user.id)
    .single();

  if (roleError || userData.role !== "artist") {
    window.location.href = "index.html";
    return;
  }

  // ✅ Resolve artist name once — from users table first, then metadata fallback
  const artistName = userData.full_name
    || user.user_metadata?.full_name
    || "Unknown Artist";

  /* ── LOAD STATS ── */
  async function loadStats() {
    const { data: artworks } = await supabase
      .from("artworks")
      .select("*")
      .eq("artist_id", user.id);

    document.getElementById("totalArtworks").innerText = artworks ? artworks.length : 0;

    let totalPrice = 0;
    artworks?.forEach(a => totalPrice += Number(a.price));

    document.getElementById("avgPrice").innerText =
      "₹" + (artworks?.length
        ? Math.round(totalPrice / artworks.length).toLocaleString("en-IN")
        : "0");

    renderArtworks(artworks || []);
  }

  /* ── RENDER ARTWORKS ── */
  function renderArtworks(list) {
    const container = document.getElementById("yourArtworks");
    if (!container) return;

    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = `
        <div style="
          grid-column: 1/-1;
          text-align:center;
          padding:60px 20px;
          color:#aaa;
          background:white;
          border-radius:14px;
        ">
          <div style="font-size:52px;">🎨</div>
          <p style="margin-top:10px; font-size:15px;">No artworks yet. Click <strong>+ Add Artwork</strong> to get started!</p>
        </div>
      `;
      return;
    }

    list.forEach(art => {
      const imageSrc = art.image_url || "https://via.placeholder.com/300x200?text=No+Image";

      container.innerHTML += `
        <div class="art-card">
          <img src="${imageSrc}" alt="${art.title}"
               onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
          <div class="art-card-body">
            <h3>${art.title}</h3>
            <div class="price">₹${Number(art.price).toLocaleString("en-IN")}</div>
            <div class="category">${art.category || ""}</div>
            <div class="art-actions">
              <button class="btn-edit" onclick="editArtwork('${art.id}')">✏️ Edit</button>
              <button class="btn-delete" onclick="deleteArtwork('${art.id}')">🗑 Delete</button>
            </div>
          </div>
        </div>
      `;
    });
  }

  /* ── DELETE ── */
  window.deleteArtwork = async function (id) {
    if (!confirm("Are you sure you want to delete this artwork?")) return;

    const { error } = await supabase.from("artworks").delete().eq("id", id);

    if (error) {
      showToast("❌ Delete failed", "error");
    } else {
      showToast("🗑 Artwork deleted");
      loadStats();
    }
  };

  /* ── EDIT ── */
  window.editArtwork = function (id) {
    window.location.href = `edit-artwork.html?id=${id}`;
  };

  /* ── UPLOAD ── */
  document.getElementById("uploadBtn").addEventListener("click", async () => {
    const title       = document.getElementById("title").value.trim();
    const price       = document.getElementById("price").value.trim();
    const category    = document.getElementById("category").value;
    const description = document.getElementById("description").value.trim();
    const dimensions  = document.getElementById("dimensions").value.trim();
    const medium      = document.getElementById("medium").value.trim();
    const files       = document.getElementById("mediaFiles").files;

    if (!title || !price || !category) {
      showToast("⚠️ Title, Price and Category are required", "error");
      return;
    }

    const uploadBtn = document.getElementById("uploadBtn");
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = "<span>⏳</span> Uploading...";

    let image_url = null;

    try {
      /* ── Upload image ── */
      if (files.length > 0) {
        const { interval, fill } = animateProgress("Uploading image...");

        const file = files[0];
        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("artworks")
          .upload(filePath, file);

        clearInterval(interval);

        if (uploadError) {
          showToast("❌ Image upload failed: " + uploadError.message, "error");
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = "<span>🚀</span> Upload Artwork";
          return;
        }

        const { data: urlData } = supabase.storage
          .from("artworks")
          .getPublicUrl(filePath);

        image_url = urlData.publicUrl;
        completeProgress();
      }

      /* ── Insert artwork ── */
      document.getElementById("progressLabel").textContent = "Saving artwork...";

      const { error } = await supabase.from("artworks").insert({
        title,
        price: parseFloat(price),
        category,
        description,
        dimensions,
        medium,
        artist_id: user.id,
        artist_name: artistName,    
        image_url,
      });

      if (error) {
        showToast("❌ " + error.message, "error");
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = "<span>🚀</span> Upload Artwork";
        return;
      }

      completeProgress();
      showToast("✅ Artwork uploaded successfully!");

      setTimeout(() => {
        closeModal();
        loadStats();
      }, 800);

    } catch (err) {
      showToast("❌ Unexpected error: " + err.message, "error");
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = "<span>🚀</span> Upload Artwork";
    }
  });

  /* ── LOGOUT ── */
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });

  /* ── INIT ── */
  loadStats();
});

/* ── TOAST HELPER ── */
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.className = "toast", 3500);
}