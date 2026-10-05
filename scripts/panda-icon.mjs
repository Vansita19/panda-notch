// src/components/Panda.tsx
import { useId } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function Panda({ mood = "idle", mini = false }) {
  const id = useId().replace(/:/g, "");
  return /* @__PURE__ */ jsxs("svg", { className: `panda panda-${mood} ${mini ? "panda-mini" : ""}`, viewBox: mini ? "8 0 104 91" : "0 0 120 142", fill: "none", role: "img", "aria-label": mood === "sleep" ? "Panda resting" : "Your panda buddy", children: [
    /* @__PURE__ */ jsxs("defs", { children: [
      /* @__PURE__ */ jsxs("linearGradient", { id: id + "fur", x1: "30", y1: "20", x2: "100", y2: "100", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ jsx("stop", { stopColor: "#fffaf0" }),
        /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#e6e2d7" })
      ] }),
      /* @__PURE__ */ jsxs("linearGradient", { id: id + "dark", x1: "25", y1: "15", x2: "90", y2: "120", gradientUnits: "userSpaceOnUse", children: [
        /* @__PURE__ */ jsx("stop", { stopColor: "#3d4146" }),
        /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#15171b" })
      ] })
    ] }),
    !mini && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("ellipse", { className: "panda-shadow", cx: "60", cy: "135", rx: "36", ry: "5", fill: "#000", opacity: ".22" }),
      /* @__PURE__ */ jsxs("g", { className: "panda-feet", children: [
        /* @__PURE__ */ jsx("ellipse", { className: "foot foot-left", cx: "39", cy: "122", rx: "16", ry: "13", fill: `url(#${id}dark)` }),
        /* @__PURE__ */ jsx("ellipse", { className: "foot foot-right", cx: "80", cy: "122", rx: "16", ry: "13", fill: `url(#${id}dark)` })
      ] }),
      /* @__PURE__ */ jsxs("g", { className: "panda-body", children: [
        /* @__PURE__ */ jsx("ellipse", { cx: "60", cy: "102", rx: "34", ry: "29", fill: `url(#${id}dark)` }),
        /* @__PURE__ */ jsx("ellipse", { cx: "60", cy: "104", rx: "24", ry: "24", fill: `url(#${id}fur)` }),
        /* @__PURE__ */ jsx("ellipse", { className: "arm arm-left", cx: "26", cy: "92", rx: "11", ry: "20", transform: "rotate(23 26 92)", fill: `url(#${id}dark)` }),
        /* @__PURE__ */ jsx("ellipse", { className: "arm arm-right", cx: "94", cy: "91", rx: "11", ry: "20", transform: "rotate(-23 94 91)", fill: `url(#${id}dark)` })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("g", { className: "panda-head", children: [
      /* @__PURE__ */ jsx("circle", { cx: "28", cy: "20", r: "17", fill: `url(#${id}dark)` }),
      /* @__PURE__ */ jsx("circle", { cx: "92", cy: "20", r: "17", fill: `url(#${id}dark)` }),
      /* @__PURE__ */ jsx("circle", { cx: "27", cy: "20", r: "9", fill: "#4b4b50" }),
      /* @__PURE__ */ jsx("circle", { cx: "93", cy: "20", r: "9", fill: "#4b4b50" }),
      /* @__PURE__ */ jsx("path", { d: "M60 13C28 13 11 33 11 57C11 81 30 92 60 92C90 92 109 81 109 57C109 33 92 13 60 13Z", fill: `url(#${id}fur)` }),
      /* @__PURE__ */ jsx("path", { d: "M47 16Q50 7 60 11Q54 13 57 17", fill: "#fffaf0" }),
      /* @__PURE__ */ jsx("ellipse", { cx: "36", cy: "51", rx: "15", ry: "19", transform: "rotate(28 36 51)", fill: `url(#${id}dark)` }),
      /* @__PURE__ */ jsx("ellipse", { cx: "84", cy: "51", rx: "15", ry: "19", transform: "rotate(-28 84 51)", fill: `url(#${id}dark)` }),
      /* @__PURE__ */ jsxs("g", { className: "panda-eyes", children: [
        /* @__PURE__ */ jsx("ellipse", { cx: "40", cy: "50", rx: "8", ry: "11", fill: "#fffaf1" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "80", cy: "50", rx: "8", ry: "11", fill: "#fffaf1" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "42", cy: "53", rx: "5.5", ry: "8", fill: "#171a20" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "78", cy: "53", rx: "5.5", ry: "8", fill: "#171a20" }),
        /* @__PURE__ */ jsx("circle", { cx: "42", cy: "48", r: "3", fill: "white" }),
        /* @__PURE__ */ jsx("circle", { cx: "78", cy: "48", r: "3", fill: "white" }),
        /* @__PURE__ */ jsx("circle", { cx: "44", cy: "57", r: "1.3", fill: "white" }),
        /* @__PURE__ */ jsx("circle", { cx: "80", cy: "57", r: "1.3", fill: "white" })
      ] }),
      /* @__PURE__ */ jsx("g", { className: "sleep-eyes", stroke: "#f7f2e7", strokeWidth: "3", strokeLinecap: "round", children: /* @__PURE__ */ jsx("path", { d: "M33 52q7 6 14 0M73 52q7 6 14 0" }) }),
      /* @__PURE__ */ jsx("ellipse", { cx: "26", cy: "70", rx: "8", ry: "4.5", fill: "#edafa6", opacity: ".65" }),
      /* @__PURE__ */ jsx("ellipse", { cx: "94", cy: "70", rx: "8", ry: "4.5", fill: "#edafa6", opacity: ".65" }),
      /* @__PURE__ */ jsx("path", { d: "M53 64Q60 60 67 64Q68 68 60 72Q52 68 53 64Z", fill: "#282b30" }),
      /* @__PURE__ */ jsx("path", { d: "M60 71v4m0 0q-6 7-12 0m12 0q6 7 12 0", stroke: "#282b30", strokeWidth: "2.8", strokeLinecap: "round" }),
      /* @__PURE__ */ jsx("path", { className: "panda-happy", d: "M52 77q8 14 16 0", fill: "#d99496" })
    ] })
  ] });
}
function PandaBanner({ alert, onDone, onLater }) {
  return /* @__PURE__ */ jsxs("section", { className: "banner-stage", "aria-label": "Panda reminder", children: [
    /* @__PURE__ */ jsxs("div", { className: "banner-procession", children: [
      /* @__PURE__ */ jsx(Panda, { mood: "walk" }),
      /* @__PURE__ */ jsxs("div", { className: "panda-sign", children: [
        /* @__PURE__ */ jsx("span", { className: "banner-kicker", children: "a little reminder" }),
        /* @__PURE__ */ jsx("strong", { children: alert.title }),
        /* @__PURE__ */ jsx("span", { children: alert.sub }),
        /* @__PURE__ */ jsx("i", { className: "holding-paw" })
      ] })
    ] }, alert.id),
    /* @__PURE__ */ jsxs("div", { className: "banner-actions", children: [
      /* @__PURE__ */ jsx("button", { onClick: onLater, children: "In 15 min" }),
      /* @__PURE__ */ jsxs("button", { onClick: onDone, children: [
        "Thanks, buddy ",
        /* @__PURE__ */ jsx("span", { children: "\u2661" })
      ] })
    ] })
  ] });
}
export {
  Panda,
  PandaBanner
};
