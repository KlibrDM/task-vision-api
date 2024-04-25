import { Request } from "express";

export const getCookies = (req: Request) => {
  const cookie = req.headers.cookie;
  const cookieMap: { [key: string]: string } = {};
  if (cookie) {
    cookie.split('; ').forEach((el) => {
      const [k, v] = el.split('=');
      cookieMap[k.trim()] = v;
    });
  }
  return cookieMap;
}
