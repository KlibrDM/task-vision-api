import jwt, { JwtPayload } from 'jsonwebtoken';

export const generateTokens = (id: string) => {
  const accessToken = jwt.sign({ id }, process.env.TOKEN_KEY!, { expiresIn: '30d' });
  const refreshToken = jwt.sign({ id }, process.env.TOKEN_KEY!, { expiresIn: '90d' });
  return { accessToken, refreshToken };
}

export const decodeToken = (token: string) => {
  return jwt.verify(token, process.env.TOKEN_KEY!) as JwtPayload;
}

export const generateAccessToken = (id: string) => {
  return jwt.sign({ id }, process.env.TOKEN_KEY!, { expiresIn: '30d' });
}
