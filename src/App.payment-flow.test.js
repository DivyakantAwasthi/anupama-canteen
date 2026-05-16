import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { appendOrderToSheet, readCachedMenuItems } from "./services/sheetsService";

jest.mock("qrcode.react", () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

jest.mock("./services/sheetsService", () => ({
  appendOrderToSheet: jest.fn(async ({ orderId }) => ({ ok: true, orderId })),
  FALLBACK_MENU_DATA: [{ id: "tea", name: "Tea", price: 20, active: true }],
  fetchActiveMenuItems: jest.fn(async () => [
    { id: "tea", name: "Tea", price: 20, active: true },
  ]),
  fetchOrderStatusFromSheet: jest.fn(async () => null),
  readCachedMenuItems: jest.fn(() => [{ id: "tea", name: "Tea", price: 20, active: true }]),
}));

jest.mock("./services/reviewService", () => ({
  fetchReviewsByItemIds: jest.fn(async () => ({})),
  saveReviewForItem: jest.fn(async () => ({ ok: true })),
}));

jest.mock("./services/whatsappService", () => ({
  sendWhatsAppStatusNotification: jest.fn(async () => ({ ok: true })),
}));

const clickByText = async (text) => {
  const target = [...document.querySelectorAll("button, a")].find(
    (element) => element.textContent.trim() === text
  );
  expect(target).toBeTruthy();
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const changeInput = async (selector, value) => {
  const input = document.querySelector(selector);
  expect(input).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("payment confirmation flow", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    readCachedMenuItems.mockReturnValue([
      { id: "tea", name: "Tea", price: 20, active: true },
    ]);
    appendOrderToSheet.mockImplementation(async (payload) => ({
      ok: true,
      orderId: payload?.orderId || 1,
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps a new UPI order pending until the user confirms payment", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await clickByText("Add");
    await clickByText("Proceed to checkout");
    await changeInput("#customer-name", "Test User");
    await changeInput("#customer-phone", "9876543210");
    await clickByText("Save order");

    expect(document.body.textContent).toContain("Awaiting payment confirmation");
    expect(document.body.textContent).toContain("Complete payment and click below");
    expect(document.body.textContent).not.toContain("Payment received");
    expect(appendOrderToSheet).not.toHaveBeenCalled();

    await clickByText("I have paid");
    expect(document.body.textContent).toContain("Are you sure payment is completed?");

    await clickByText("Yes, I paid");

    expect(appendOrderToSheet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "payment_verified" })
    );
    expect(document.body.textContent).toContain("Payment received");
  });
});
