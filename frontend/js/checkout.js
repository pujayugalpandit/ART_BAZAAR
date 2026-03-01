const BACKEND_URL = "https://art-bazaar-4nm8.onrender.com";
const RAZORPAY_KEY_ID = "rzp_test_SLsnMoiJyraWIJ";

let cartData = null;
let userInfo = null;

document.addEventListener("DOMContentLoaded", initCheckout);

async function initCheckout() {
  console.log("🔄 Initializing checkout page...");
  
  // Check authentication
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    console.log("❌ No user session, redirecting to login");
    window.location.href = "login.html";
    return;
  }

  console.log("✅ User authenticated:", user.email);

  // Load cart data
  await loadCheckoutCart(user.id);
  
  // Pre-fill email if form exists
  const emailInput = document.getElementById("email");
  if (emailInput) {
    emailInput.value = user.email;
  }

  // Handle form submission
  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", handleCheckoutSubmit);
    console.log("✅ Form listener attached");
  } else {
    console.warn("⚠️ checkout-form not found");
  }
}

async function loadCheckoutCart(userId) {
  try {
    console.log("🔄 Loading cart data...");
    
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
    console.log("✅ Cart loaded successfully:", data.length, "items");
    displayOrderSummary();
    
  } catch (err) {
    console.error("❌ Unexpected error loading cart:", err);
    alert("Failed to load cart. Please try again.");
  }
}

function displayOrderSummary() {
  try {
    console.log("🔄 Displaying order summary...");
    
    let subtotal = 0;
    let itemsHTML = "";

    cartData.forEach(item => {
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

    const orderItemsDiv = document.getElementById("orderItems");
    if (orderItemsDiv) {
      orderItemsDiv.innerHTML = itemsHTML;
    }
    
    const subtotalSpan = document.getElementById("orderSubtotal");
    if (subtotalSpan) {
      subtotalSpan.innerText = "₹" + subtotal.toLocaleString("en-IN");
    }
    
    const gstSpan = document.getElementById("orderGst");
    if (gstSpan) {
      gstSpan.innerText = "₹" + gst.toLocaleString("en-IN");
    }
    
    const totalSpan = document.getElementById("orderTotal");
    if (totalSpan) {
      totalSpan.innerText = "₹" + total.toLocaleString("en-IN");
    }

    console.log("✅ Order summary displayed. Total: ₹" + total.toFixed(2));
    
  } catch (err) {
    console.error("❌ Error displaying order summary:", err);
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  console.log("🔄 Checkout form submitted...");

  try {
    // Collect shipping details
    userInfo = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      address: document.getElementById("address").value,
      city: document.getElementById("city").value,
      state: document.getElementById("state").value,
      pincode: document.getElementById("pincode").value,
    };

    console.log("✅ Shipping details collected");

    // Validate required fields
    if (!userInfo.name || !userInfo.email || !userInfo.phone || !userInfo.address) {
      alert("Please fill all required fields");
      console.warn("⚠️ Missing required fields");
      return;
    }

    // Start payment
    await startPayment();
    
  } catch (err) {
    console.error("❌ Error in checkout form submission:", err);
    alert("An error occurred. Please try again.");
  }
}

async function startPayment() {
  try {
    console.log("🔄 Starting payment process...");

    // Validate cart data
    if (!cartData || cartData.length === 0) {
      console.error("❌ No cart data available");
      alert("Cart is empty. Please add items before checking out.");
      return;
    }

    // Calculate amount from cart data
    let subtotal = 0;
    cartData.forEach(item => {
      subtotal += item.artworks.price * item.quantity;
    });

    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    const amountInPaise = Math.round(total * 100); // Convert to paise

    console.log("💰 Amount calculation:", {
      subtotal: subtotal,
      gst: gst,
      total: total,
      amountInPaise: amountInPaise
    });

    // Show loading state
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Processing...";
    }

    // Create order on backend
    console.log("🔄 Creating order on backend:", BACKEND_URL);
    
    const orderRes = await fetch(`${BACKEND_URL}/create-order`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        notes: {
          customer_name: userInfo.name,
          customer_email: userInfo.email,
          customer_phone: userInfo.phone,
          shipping_address: userInfo.address,
          shipping_city: userInfo.city,
          shipping_state: userInfo.state,
          shipping_pincode: userInfo.pincode,
        }
      })
    });

    console.log("📡 Backend response status:", orderRes.status);

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error("❌ Backend error response:", errorText);
      throw new Error(`Backend error: ${orderRes.status} ${errorText}`);
    }

    const orderData = await orderRes.json();
    console.log("✅ Order created on backend:", orderData.id);

    // Razorpay payment options
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

      handler: async function (response) {
        console.log("🔄 Payment successful, verifying...", response);
        
        try {
          // Payment successful - verify on backend
          const verifyRes = await fetch(`${BACKEND_URL}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
          });

          console.log("📡 Verification response status:", verifyRes.status);

          const result = await verifyRes.json();
          console.log("✅ Verification result:", result);

          if (result.success) {
            // Clear cart after successful payment
            await clearUserCart();
            
            // Store order info in session
            sessionStorage.setItem("lastOrder", JSON.stringify({
              orderId: orderData.id,
              paymentId: response.razorpay_payment_id,
              amount: orderData.amount,
              ...userInfo
            }));

            console.log("✅ Payment verified and cart cleared");
            alert("Payment successful! Redirecting...");
            window.location.href = "success.html";
          } else {
            console.error("❌ Verification failed:", result);
            alert("Payment verification failed. Please contact support.");
          }
        } catch (verifyErr) {
          console.error("❌ Verification error:", verifyErr);
          alert("Error verifying payment. Please contact support.");
        }
      },

      modal: {
        ondismiss: function() {
          console.log("⚠️ Payment modal closed by user");
          // Re-enable button
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Proceed to Payment →";
          }
        }
      }
    };

    console.log("🔄 Opening Razorpay modal...");
    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error("❌ Payment error:", err);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    
    alert("Payment failed: " + err.message);
    
    // Re-enable button
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
      await supabase
        .from("cart")
        .delete()
        .eq("user_id", user.id);
      
      console.log("✅ Cart cleared for user:", user.id);
    }
  } catch (err) {
    console.error("❌ Error clearing cart:", err);
  }
}

// Export for testing
window.startPayment = startPayment;
window.handleCheckoutSubmit = handleCheckoutSubmit;
