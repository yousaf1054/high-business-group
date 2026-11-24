const products = [
  { id: 1, name: "Veggie Supreme Pizza", category: "Pizza", price: 349, oldPrice: 440, rating: 4.8, reviews: 320, discount: "-20%", image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=85" },
  { id: 2, name: "Thai Basil Noodles", category: "Asian", price: 249, oldPrice: null, rating: 4.7, reviews: 210, discount: null, image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=85" },
  { id: 3, name: "Zesty Chicken Burger", category: "Burgers", price: 279, oldPrice: 330, rating: 4.9, reviews: 410, discount: "-15%", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85" },
  { id: 4, name: "Classic Veg Burger", category: "Burgers", price: 199, oldPrice: null, rating: 4.6, reviews: 186, discount: null, image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=85" },
  { id: 5, name: "Chocolate Lava Cake", category: "Desserts", price: 189, oldPrice: 220, rating: 4.9, reviews: 275, discount: "-14%", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=85" },
  { id: 6, name: "Fresh Berry Mojito", category: "Drinks", price: 149, oldPrice: null, rating: 4.7, reviews: 128, discount: null, image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=85" }
];

const CART_KEY = "zesty-cart";
const DELIVERY_FEE = 40;
const WHATSAPP_NUMBER = "917356766905";
const productGrid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const checkout = document.getElementById("checkout");
const toast = document.getElementById("toast");
const billPreviewModal = document.getElementById("billPreviewModal");
const billPreviewImage = document.getElementById("billPreviewImage");
let pendingOrder = null;

function loadCart() {
  const saved = localStorage.getItem(CART_KEY);
  if (!saved) return [];
  try {
    const data = JSON.parse(saved);
    if (!Array.isArray(data)) throw new TypeError("Saved cart is not a list");
    return data.filter(item =>
      products.some(product => product.id === item.id) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    ).map(item => ({ ...products.find(product => product.id === item.id), quantity: item.quantity }));
  } catch (error) {
    console.error("Could not read the saved cart.", error);
    return [];
  }
}

let cart = loadCart();

function formatCurrency(amount) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function cartSubtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderProducts(category = "All") {
  if (!productGrid) return;
  const visible = category === "All" ? products : products.filter(item => item.category === category);
  productGrid.innerHTML = visible.map(product => `
    <article class="product-card">
      ${product.discount ? `<span class="discount">${product.discount}</span>` : ""}
      <button class="wishlist" type="button" aria-label="Add ${product.name} to favourites" data-wishlist="${product.id}">♡</button>
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="rating"><b>★</b> ${product.rating} <span>(${product.reviews})</span></div>
        <div class="price-row">
          <div><strong>₹${product.price}</strong>${product.oldPrice ? `<del>₹${product.oldPrice}</del>` : ""}</div>
          <button class="add-button" type="button" aria-label="Add ${product.name} to cart" data-add="${product.id}">+</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const subtotal = cartSubtotal();
  const delivery = subtotal ? DELIVERY_FEE : 0;
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("#cartCount").forEach(element => { element.textContent = quantity; });

  if (cartItems) {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div><h4>${item.name}</h4><span class="cart-price">${formatCurrency(item.price)}</span>
          <div class="quantity"><button type="button" data-minus="${item.id}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-plus="${item.id}" aria-label="Increase quantity">+</button></div>
        </div><strong>${formatCurrency(item.price * item.quantity)}</strong>
      </div>
    `).join("");
  }
  if (cartEmpty) cartEmpty.classList.toggle("show", cart.length === 0);
  if (checkout) checkout.classList.toggle("hidden", cart.length === 0);

  const totals = {
    subtotal: formatCurrency(subtotal),
    delivery: formatCurrency(delivery),
    total: formatCurrency(subtotal + delivery)
  };
  [["subtotal", totals.subtotal], ["delivery", totals.delivery], ["grandTotal", totals.total],
    ["orderSubtotal", totals.subtotal], ["orderDelivery", totals.delivery], ["orderGrandTotal", totals.total]
  ].forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const orderItems = document.getElementById("orderItems");
  if (orderItems) {
    orderItems.innerHTML = cart.map(item => `
      <div class="order-item">
        <img src="${item.image}" data-bill-product-id="${item.id}" crossorigin="anonymous" alt="${item.name}">
        <div class="order-item-info"><strong>${item.name}</strong><span>${formatCurrency(item.price)} each</span>
          <div class="quantity"><button type="button" data-minus="${item.id}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-plus="${item.id}" aria-label="Increase quantity">+</button></div>
        </div><strong class="order-item-total">${formatCurrency(item.price * item.quantity)}</strong>
      </div>
    `).join("");
  }
  const orderEmpty = document.getElementById("orderEmpty");
  if (orderEmpty) orderEmpty.classList.toggle("show", cart.length === 0);

  localStorage.setItem(CART_KEY, JSON.stringify(cart.map(({ id, quantity }) => ({ id, quantity }))));
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const existing = cart.find(item => item.id === id);
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, quantity: 1 });
  renderCart();
  showToast(`${product.name} added to cart`);
}

function changeQuantity(id, change) {
  const item = cart.find(cartItem => cartItem.id === id);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) cart = cart.filter(cartItem => cartItem.id !== id);
  renderCart();
}

function openCart() {
  if (!cartDrawer || !overlay) return;
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

function closeCart() {
  if (!cartDrawer || !overlay) return;
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function closeBillPreview() {
  if (!billPreviewModal) return;
  billPreviewModal.classList.remove("show");
  billPreviewModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
}

function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawBill(formData) {
  const canvas = document.createElement("canvas");
  const width = 1000;
  const padding = 74;
  const rowHeight = 270;
  const imageSize = 190;
  const firstRowY = 332;
  const summaryY = firstRowY + cart.length * rowHeight + 45;
  const right = width - padding;
  canvas.width = width;
  canvas.height = 1;
  let context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create the bill image.");
  context.font = "500 22px Manrope, Arial, sans-serif";
  const detailLines = [
    `Name: ${formData.get("customerName")}`,
    `Phone: ${formData.get("customerPhone")}`,
    ...wrapText(context, `Address: ${formData.get("address")}`, width - padding * 2)
  ];
  const notes = String(formData.get("notes") || "").trim();
  if (notes) detailLines.push(...wrapText(context, `Note: ${notes}`, width - padding * 2));
  const height = summaryY + 390 + detailLines.length * 38;
  canvas.height = height;
  context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create the bill image.");

  context.fillStyle = "#fff8f4";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#f0e7e2";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(8, 8, width - 16, height - 16, 40);
  context.fill();
  context.stroke();

  context.fillStyle = "#f04f35";
  context.font = "800 26px Manrope, Arial, sans-serif";
  context.fillText("YOUR SELECTION", padding, 120);
  context.fillStyle = "#191923";
  context.font = "700 54px Manrope, Arial, sans-serif";
  context.fillText("Order Summary", padding, 208);

  cart.forEach((item, index) => {
    const y = firstRowY + index * rowHeight;
    const image = document.querySelector(`[data-bill-product-id="${item.id}"]`);
    const imageX = padding;
    const imageY = y;

    context.save();
    context.beginPath();
    context.roundRect(imageX, imageY, imageSize, imageSize, 28);
    context.clip();
    if (image && image.complete && image.naturalWidth > 0) {
      const scale = Math.max(imageSize / image.naturalWidth, imageSize / image.naturalHeight);
      const cropWidth = imageSize / scale;
      const cropHeight = imageSize / scale;
      context.drawImage(
        image,
        (image.naturalWidth - cropWidth) / 2,
        (image.naturalHeight - cropHeight) / 2,
        cropWidth,
        cropHeight,
        imageX,
        imageY,
        imageSize,
        imageSize
      );
    } else {
      const icon = { Pizza: "🍕", Asian: "🍜", Burgers: "🍔", Desserts: "🍰", Drinks: "🥤" }[item.category] || "🍽";
      context.fillStyle = "#fff0e9";
      context.fillRect(imageX, imageY, imageSize, imageSize);
      context.font = "80px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(icon, imageX + imageSize / 2, imageY + imageSize / 2);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
    }
    context.restore();

    const textX = padding + imageSize + 32;
    context.fillStyle = "#191923";
    context.font = "700 30px Manrope, Arial, sans-serif";
    const nameLines = wrapText(context, item.name, right - textX - 185);
    nameLines.forEach((line, lineIndex) => context.fillText(line, textX, y + 42 + lineIndex * 38));

    context.fillStyle = "#777783";
    context.font = "500 23px Manrope, Arial, sans-serif";
    context.fillText(`${formatCurrency(item.price)} each`, textX, y + 92);

    const controlY = y + 158;
    const drawQuantityCircle = (x, label) => {
      context.beginPath();
      context.arc(x, controlY, 34, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
      context.strokeStyle = "#eee4df";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#191923";
      context.font = "500 31px Manrope, Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, x, controlY - 1);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
    };
    drawQuantityCircle(textX + 34, "−");
    context.fillStyle = "#191923";
    context.font = "700 26px Manrope, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(item.quantity), textX + 112, controlY);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    drawQuantityCircle(textX + 190, "+");

    context.fillStyle = "#191923";
    context.font = "700 29px Manrope, Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(formatCurrency(item.price * item.quantity), right, y + 104);
    context.textAlign = "left";

    const dividerY = y + rowHeight - 22;
    context.strokeStyle = "#eee5df";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, dividerY);
    context.lineTo(right, dividerY);
    context.stroke();
  });

  const subtotal = cartSubtotal();
  context.setLineDash([5, 6]);
  context.strokeStyle = "#e9ded8";
  context.beginPath();
  context.moveTo(padding, summaryY);
  context.lineTo(right, summaryY);
  context.stroke();
  context.setLineDash([]);

  const drawTotalRow = (label, amount, y, isTotal = false) => {
    context.fillStyle = isTotal ? "#f04f35" : "#555560";
    context.font = `${isTotal ? "700 40px" : "500 30px"} Manrope, Arial, sans-serif`;
    context.fillText(label, padding, y);
    context.fillStyle = isTotal ? "#f04f35" : "#191923";
    context.font = `${isTotal ? "800 38px" : "700 30px"} Manrope, Arial, sans-serif`;
    context.textAlign = "right";
    context.fillText(amount, right, y);
    context.textAlign = "left";
  };
  drawTotalRow("Subtotal", formatCurrency(subtotal), summaryY + 60);
  drawTotalRow("Delivery", formatCurrency(DELIVERY_FEE), summaryY + 120);
  context.setLineDash([5, 6]);
  context.strokeStyle = "#e9ded8";
  context.beginPath();
  context.moveTo(padding, summaryY + 150);
  context.lineTo(right, summaryY + 150);
  context.stroke();
  context.setLineDash([]);
  drawTotalRow("Total", formatCurrency(subtotal + DELIVERY_FEE), summaryY + 215, true);

  context.fillStyle = "#191923";
  context.font = "700 24px Manrope, Arial, sans-serif";
  context.fillText("DELIVERY DETAILS", padding, summaryY + 292);
  context.fillStyle = "#555560";
  context.font = "500 22px Manrope, Arial, sans-serif";
  detailLines.forEach((line, index) => context.fillText(line, padding, summaryY + 334 + index * 38));
  return canvas;
}

function makeOrderMessage(formData) {
  const subtotal = cartSubtotal();
  const lines = [
    "Hello Zesty! I would like to place an order.",
    "Please send this order to +91 73567 66905:",
    "",
    ...cart.map(item => `• ${item.name} x ${item.quantity} — ${formatCurrency(item.price * item.quantity)}`),
    "",
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Delivery: ${formatCurrency(DELIVERY_FEE)}`,
    `Total: ${formatCurrency(subtotal + DELIVERY_FEE)}`,
    "",
    `Name: ${formData.get("customerName")}`,
    `Phone: ${formData.get("customerPhone")}`,
    `Address: ${formData.get("address")}`
  ];
  const notes = String(formData.get("notes") || "").trim();
  if (notes) lines.push(`Notes: ${notes}`);
  return lines.join("\n");
}

renderProducts();
renderCart();

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderProducts(button.dataset.category);
  });
});

if (productGrid) {
  productGrid.addEventListener("click", event => {
    const addButton = event.target.closest("[data-add]");
    const wishlistButton = event.target.closest("[data-wishlist]");
    if (addButton) addToCart(Number(addButton.dataset.add));
    if (wishlistButton) {
      wishlistButton.classList.toggle("liked");
      wishlistButton.textContent = wishlistButton.classList.contains("liked") ? "♥" : "♡";
    }
  });
}

document.querySelectorAll(".cart-items, .order-items").forEach(list => {
  list.addEventListener("click", event => {
    const minus = event.target.closest("[data-minus]");
    const plus = event.target.closest("[data-plus]");
    if (minus) changeQuantity(Number(minus.dataset.minus), -1);
    if (plus) changeQuantity(Number(plus.dataset.plus), 1);
  });
});

const openCartButton = document.getElementById("openCart");
const closeCartButton = document.getElementById("closeCart");
const continueShoppingButton = document.getElementById("continueShopping");
if (openCartButton) openCartButton.addEventListener("click", openCart);
if (closeCartButton) closeCartButton.addEventListener("click", closeCart);
if (continueShoppingButton) continueShoppingButton.addEventListener("click", () => {
  closeCart();
  window.location.href = "products.html";
});
if (overlay) overlay.addEventListener("click", closeCart);

const orderForm = document.getElementById("orderForm");
if (orderForm) {
  orderForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!cart.length) {
      showToast("Add at least one product before placing your order.");
      return;
    }

    const formData = new FormData(orderForm);
    try {
      const canvas = drawBill(formData);
      pendingOrder = {
        image: canvas.toDataURL("image/png"),
        message: makeOrderMessage(formData)
      };
      billPreviewImage.src = pendingOrder.image;
      billPreviewModal.classList.add("show");
      billPreviewModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("locked");
    } catch (error) {
      console.error("Could not prepare the order bill.", error);
      showToast("Could not create the bill preview. Please try again.");
    }
  });
}

const closeBillPreviewButton = document.getElementById("closeBillPreview");
const downloadAndOpenWhatsAppButton = document.getElementById("downloadAndOpenWhatsApp");
if (closeBillPreviewButton) closeBillPreviewButton.addEventListener("click", closeBillPreview);
if (downloadAndOpenWhatsAppButton) {
  downloadAndOpenWhatsAppButton.addEventListener("click", async () => {
    if (!pendingOrder) {
      showToast("Create a bill preview before continuing.");
      return;
    }

    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) whatsappWindow.opener = null;
    downloadAndOpenWhatsAppButton.disabled = true;
    downloadAndOpenWhatsAppButton.textContent = "Uploading bill...";

    try {
      const response = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: pendingOrder.image })
      });
      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        if (response.status === 405) {
          throw new Error("This server only serves static files. Stop Live Server and run `node dev-server.js` to enable hosted receipts.");
        }
        throw new Error(`Receipt server returned HTTP ${response.status}.`);
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Receipt upload failed.");

      const receiptUrl = new URL(result.receiptUrl);
      const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      const isExpectedOrigin = receiptUrl.origin === window.location.origin ||
        (isLocalDevelopment && receiptUrl.protocol === "https:");
      if (!isExpectedOrigin || !/^\/api\/receipt\?id=[a-f0-9]{32}$/.test(receiptUrl.pathname + receiptUrl.search)) {
        throw new Error("Receipt service returned an invalid link.");
      }

      const message = `${pendingOrder.message}\n\nView your bill: ${receiptUrl.href}`;
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      closeBillPreview();
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      console.error("Could not upload the order bill.", error);
      showToast(error.message || "Could not upload the bill. Please try again.");
    } finally {
      downloadAndOpenWhatsAppButton.disabled = false;
      downloadAndOpenWhatsAppButton.innerHTML = "<span>◉</span> Upload Bill & Open WhatsApp";
    }
  });
}

const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(contactForm);
    const message = encodeURIComponent(`Hello Zesty,\n\nName: ${form.get("name")}\nPhone: ${form.get("phone")}\nMessage: ${form.get("message")}`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener");
    contactForm.reset();
  });
}

const newsletter = document.getElementById("newsletter");
if (newsletter) newsletter.addEventListener("submit", event => {
  event.preventDefault();
  newsletter.reset();
  showToast("Thanks! You are subscribed.");
});

const menuButton = document.getElementById("menuButton");
const navLinks = document.getElementById("navLinks");
if (menuButton && navLinks) {
  menuButton.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", event => {
    if (event.target.matches("a")) {
      navLinks.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

const searchButton = document.querySelector(".search-button");
if (searchButton) searchButton.addEventListener("click", () => {
  window.location.href = "products.html";
});
const watchButton = document.getElementById("watchVideo");
if (watchButton) watchButton.addEventListener("click", () => showToast("Video coming soon"));
