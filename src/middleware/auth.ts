import { Request, Response, NextFunction } from 'express';
import { getCookies } from '../utils/getCookies';
import { decodeToken, generateAccessToken } from '../utils/generateTokens';

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const cookies = getCookies(req);
  const accessToken = req.headers['authorization'];
  const refreshToken = cookies?.['refreshToken'];

  if (!accessToken && !refreshToken) {
    return res.status(401).send('Access Denied. No token provided.');
  }

  try {
    const tokenArr = accessToken!.split(" ");
    const bearerToken = tokenArr[1];
    const decoded = decodeToken(bearerToken);
    req.headers["id"] = decoded.id;
    next();
  } catch (error) {
    if (!refreshToken) {
      return res.status(401).send('Access Denied. No refresh token provided.');
    }

    try {
      const decoded = decodeToken(refreshToken);
      const accessToken = generateAccessToken(decoded.id);

      res
        .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
        .header('Authorization', accessToken)
        .send(decoded.id);
    } catch (error) {
      return res.status(400).send('Invalid Token.');
    }
  }
};

export default authenticate;
