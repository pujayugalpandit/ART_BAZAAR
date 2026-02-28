document.addEventListener("DOMContentLoaded", async () => {
  loadArtworks();
});
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
    const card = document.createElement("div");
    card.className = "art-card";

    card.innerHTML = `
      <img src="${art.image_url}" alt="${art.title}">
      <div class="art-card-content">
        <h3>${art.title}</h3>
        <p>${art.category}</p>
        <div class="price">₹${art.price}</div>
        <button class="btn">Add to Cart</button>
      </div>
    `;

    grid.appendChild(card);
  });
  
}