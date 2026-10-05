import { useEffect, useState } from "react";

const read = () => location.hash.replace(/^#\/?/, "").split("/");

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (path) => (location.hash = "#/" + path);
