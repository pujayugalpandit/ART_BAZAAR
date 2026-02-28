document.addEventListener("DOMContentLoaded", async () => {

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  /* ---------------- ROLE CHECK ---------------- */

  const { data: userData, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (roleError || userData.role !== "artist") {
    window.location.href = "index.html";
    return;
  }
  
  /* ---------------- LOAD STATS ---------------- */

  async function loadStats() {

    const { data: artworks } = await supabase
      .from("artworks")
      .select("*")
      .eq("artist_id", user.id);

    document.getElementById("totalArtworks").innerText =
      artworks ? artworks.length : 0;

    let totalPrice = 0;
    artworks?.forEach(a => totalPrice += Number(a.price));

    document.getElementById("avgPrice").innerText =
      "₹" + (artworks?.length
        ? (totalPrice / artworks.length).toLocaleString("en-IN")
        : "0");

    renderArtworks(artworks || []);
  }

  /* ---------------- RENDER ARTWORKS ---------------- */

  function renderArtworks(list) {

    const container = document.getElementById("yourArtworks");
    if (!container) return;

    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = "<p>No artworks yet.</p>";
      return;
    }

    list.forEach(art => {

      const imageSrc = art.image_url
        ? art.image_url
        : "https://via.placeholder.com/300x200?text=No+Image";

      container.innerHTML += `
        <div class="art-card" style="margin-bottom:20px;">
          <img src="${imageSrc}" 
               style="width:100%;height:200px;object-fit:cover;border-radius:8px;">
          <h3>${art.title}</h3>
          <p>₹${Number(art.price).toLocaleString("en-IN")}</p>
          <p>${art.category}</p>

          <div style="margin-top:10px;">
            <button onclick="editArtwork('${art.id}')">Edit</button>
            <button onclick="deleteArtwork('${art.id}')">Delete</button>
          </div>
        </div>
      `;
    });
  }

  /* ---------------- DELETE ---------------- */

  window.deleteArtwork = async function (id) {

    if (!confirm("Are you sure you want to delete this artwork?"))
      return;

    const { error } = await supabase
      .from("artworks")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Delete failed");
      console.error(error);
    } else {
      alert("Artwork deleted!");
      loadStats();
    }
  };

  /* ---------------- EDIT ---------------- */

  window.editArtwork = function (id) {
    window.location.href = `edit-artwork.html?id=${id}`;
  };

  /* ---------------- UPLOAD ---------------- */

  document.getElementById("uploadBtn").addEventListener("click", async () => {

    const title = document.getElementById("title").value;
    const price = document.getElementById("price").value;
    const category = document.getElementById("category").value;
    const description = document.getElementById("description").value;
    const dimensions = document.getElementById("dimensions").value;
    const medium = document.getElementById("medium").value;

    const files = document.getElementById("mediaFiles").files;

    let image_url = null;

    /* ---- Upload first image only ---- */
    
    if (files.length > 0) {

      const file = files[0];
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("artworks")
        .upload(filePath, file);
        if (uploadError) {
          console.error(uploadError);
          alert(uploadError.message);
          return;
        }

      const { data } = supabase.storage
        .from("artworks")
        .getPublicUrl(filePath);

      image_url = data.publicUrl;
    }

    /* ---- Insert artwork once ---- */

    const { error } = await supabase
      .from("artworks")
      .insert({
        title,
        price,
        category,
        description,
        dimensions,
        medium,
        artist_id: user.id,
        artist_name: user.user_metadata?.full_name || "",
        image_url
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Artwork uploaded!");
    closeModal();
    loadStats();
  });

  /* ---------------- MODAL ---------------- */

  window.closeModal = function () {
    document.getElementById("artModal").classList.add("hidden");
  };

  document.getElementById("openModal").onclick =
    () => document.getElementById("artModal").classList.remove("hidden");

  /* ---------------- INIT ---------------- */

  loadStats();

});
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});