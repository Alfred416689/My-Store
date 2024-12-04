const sneakerContainers = document.querySelectorAll(".sneaker-container");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
const sneakerWrapper = document.querySelector(".sneaker-wrapper");
const subtitle = document.getElementById("subtitle");
const title = document.querySelector(".title");
const navList = document.querySelector("nav ul");
const description = document.querySelector(".description");
const buyNowButton = document.getElementById("buy-now");
const priceElement = document.querySelector(".price");

// Data for each sneaker
const sneakerData = [
  {
    subtitle: "NIKE DUNK LOW",
    link: "https://example.com/sneaker1",
    color: "#afcbdb",
    buttonColor: "#3198d2db",
    price: "RS 2999",
    description: [
      "Crafted with high-quality leather",
      "Signature Swoosh branding",
      "Padded collar and cushioned insole",
    ],
  },
  {
    subtitle: "ADIDAS ULTRABOOST",
    link: "https://example.com/sneaker2",
    color: "#ff2424ea",
    buttonColor: "#ff2424ea",
    price: "RS 1299",
    description: [
      "Crafted with premium leather and suede for durability and a luxurious feel",
    "Limited-edition release perfect for collectors",
    ],
  },
  {
    subtitle: "PUMA RS-X",
    link: "https://example.com/sneaker3",
    color: "#ffffffeb",
    buttonColor: "#4caf50",
    price: "RS 1999",
    description: [
      "Bold retro design with mesh upper",
      "Lightweight cushioning for comfort",
      "Durable rubber sole for traction",
    ],
  },
];

let currentIndex = 0;
let isScrolling = false;

// Function to update the active sneaker container
function updateActiveContainer(index) {
  sneakerContainers.forEach((container, i) => {
    if (i === index) {
      container.classList.add("active");
    } else {
      container.classList.remove("active");
    }
  });

  // Update subtitle, title color, nav background, buy now button, and price
  subtitle.textContent = sneakerData[index].subtitle;
  title.style.color = sneakerData[index].color;
  navList.style.backgroundColor = sneakerData[index].color;
  buyNowButton.style.backgroundColor = sneakerData[index].buttonColor; // Update button color
  buyNowButton.onclick = () => {
    window.location.href = sneakerData[index].link;
  };
  priceElement.textContent = sneakerData[index].price; // Update price

  // Update description text and color
  const descHtml = sneakerData[index].description
    .map((text) => `<p style="color: ${sneakerData[index].color}">${text}</p>`)
    .join("");
  description.innerHTML = descHtml;
}

// Function to navigate to the next or previous container
function navigate(direction) {
  if (direction === "next") {
    currentIndex = (currentIndex + 1) % sneakerContainers.length;
  } else if (direction === "prev") {
    currentIndex = (currentIndex - 1 + sneakerContainers.length) % sneakerContainers.length;
  }
  scrollToContainer(currentIndex);
}

// Function to scroll to a specific container
function scrollToContainer(index) {
  isScrolling = true;
  sneakerContainers[index].scrollIntoView({ behavior: "smooth", inline: "start" });
  currentIndex = index;
  updateActiveContainer(currentIndex);
  // Delay to prevent multiple rapid scrolls
  setTimeout(() => {
    isScrolling = false;
  }, 600);
}

// Event listeners for navigation buttons
prevButton.addEventListener("click", () => {
  if (!isScrolling) navigate("prev");
});
nextButton.addEventListener("click", () => {
  if (!isScrolling) navigate("next");
});

// Debounce function to limit the rate of function calls
function debounce(func, delay) {
  let debounceTimer;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// Event listener for manual scrolling
sneakerWrapper.addEventListener(
  "scroll",
  debounce(() => {
    const containerWidth = sneakerWrapper.offsetWidth;
    const scrollLeft = sneakerWrapper.scrollLeft;
    const index = Math.round(scrollLeft / containerWidth);
    if (index !== currentIndex) {
      currentIndex = index;
      updateActiveContainer(currentIndex);
    }
  }, 5)
);



// Initialize the first container as active
updateActiveContainer(currentIndex);

document.addEventListener("DOMContentLoaded", () => {
  const splashScreen = document.getElementById("splash-screen");
  const mainContent = document.querySelector(".container");

  setTimeout(() => {
    splashScreen.style.display = "none"; // Hide splash screen
    mainContent.style.display = "block"; // Show main content
  }, 2000); // Show splash screen for 3 seconds
});