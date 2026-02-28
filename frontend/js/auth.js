
(async () => {
  const { data } = await supabase.auth.getSession();
  const path = window.location.pathname;

  if (data.session && (path.includes("login.html") || path.includes("signup.html"))) {
    window.location.replace("marketplace.html");
  }
})();
document.addEventListener("DOMContentLoaded", () => {

  console.log("Auth JS loaded");

  let selectedRole = "buyer";

  // ROLE SELECTION
  const roleBoxes = document.querySelectorAll(".role-box");

  roleBoxes.forEach(box => {
    box.addEventListener("click", () => {
      roleBoxes.forEach(b => b.classList.remove("active"));
      box.classList.add("active");
      selectedRole = box.dataset.role;
    });
  });

  // SIGNUP
  const signupBtn = document.getElementById("signupBtn");

  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {

      console.log("Signup button clicked");

      const fullName = document.getElementById("fullName").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (!data.user) {
        alert("Signup failed.");
        return;
      }

      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: data.user.id,
          full_name: fullName,
          role: selectedRole
        });

      if (insertError) {
        alert(insertError.message);
        return;
      }

      alert("Account created successfully!");
      window.location.href = "login.html";
    });
  }

  // LOGIN
  const loginBtn = document.getElementById("loginBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert(error.message);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();


      if (userData?.role === "artist") {
        window.location.href = "dashboard.html";
      } else {
        window.location.href = "marketplace.html";
      }
    });
  }
const resetBtn = document.getElementById("resetBtn");

if (resetBtn) {
  resetBtn.addEventListener("click", async () => {

    const email = document.getElementById("resetEmail").value;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/update-password.html"
    });

    console.log("Reset response:", data, error);

    if (error) {
      alert(error.message);
    } else {
      alert("Reset email triggered.");
    }

  });
}
});