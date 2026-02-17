import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "APPEMP - Sistema de Pedidos",
  description: "Sistema de gestão de pedidos, clientes e rotas",
  icons: {
    icon: "/processado1.png",
    shortcut: "/processado1.png",
    apple: "/processado1.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const REMOVE_EXTENSION_ATTRS_SCRIPT = `
(function () {
  var attrs = [
    "bis_skin_checked",
    "data-new-gr-c-s-check-loaded",
    "data-gr-ext-installed",
    "cz-shortcut-listen"
  ];

  function cleanNode(node) {
    if (!node || node.nodeType !== 1) return;
    for (var i = 0; i < attrs.length; i++) {
      if (node.hasAttribute && node.hasAttribute(attrs[i])) {
        node.removeAttribute(attrs[i]);
      }
    }
  }

  function cleanTree(root) {
    if (!root || !root.querySelectorAll) return;
    cleanNode(root);
    var selector = attrs.map(function (attr) {
      return "[" + attr + "]";
    }).join(",");
    if (!selector) return;
    var nodes = root.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      cleanNode(nodes[i]);
    }
  }

  cleanTree(document.documentElement);
  if (document.body) cleanTree(document.body);

  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var mutation = mutations[m];
      if (mutation.type === "attributes") {
        cleanNode(mutation.target);
      }
      if (mutation.type === "childList" && mutation.addedNodes) {
        for (var n = 0; n < mutation.addedNodes.length; n++) {
          cleanTree(mutation.addedNodes[n]);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: attrs
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${manrope.className} antialiased`} suppressHydrationWarning>
        <Script id="remove-extension-attrs" strategy="beforeInteractive">
          {REMOVE_EXTENSION_ATTRS_SCRIPT}
        </Script>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
