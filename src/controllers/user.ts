import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/user';
import { JwtPayload } from 'jsonwebtoken';
import { getCookies } from '../utils/getCookies';
import bcrypt from 'bcrypt';
import Logger from './log';
import { decodeToken, generateAccessToken, generateTokens } from '../utils/generateTokens';
import { LogAction, LogEntities } from '../models/log';

const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const userExists = await User.findOne({ email });
    if(userExists){
      return res.status(409).json({ message: 'Email already in use', code: 'EMAIL_IN_USE' });
    }

    // Create hashed password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      settings: {
        enable_reactivity: true,
        mention_notifications: true,
        assignment_notifications: true,
        sprint_notifications: true,
        item_notifications: true,
      },
      is_organization_controlled: false,
    });

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    Object.assign(user, { 
      access_token: accessToken,
      refresh_token: refreshToken
    });
    await user.save();

    // Logging
    Logger.logCreate(
      LogEntities.USER,
      user._id.toString(),
      user.email,
      user._id.toString(),
    );

    // Log auto-login
    Logger.log(
      LogEntities.USER,
      user._id.toString(),
      user.email,
      LogAction.LOGIN,
      undefined,
      undefined,
      undefined,
      user._id.toString(),
    );

    res
      .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
      .header('Authorization', accessToken)
      .send(user);
  }
  catch(err) {
    return res.status(500).json(err);
  }
}

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    Object.assign(user, { 
      access_token: accessToken,
      refresh_token: refreshToken
    });
    await user.save();

    // Logging
    Logger.log(
      LogEntities.USER,
      user._id.toString(),
      user.email,
      LogAction.LOGIN,
      undefined,
      undefined,
      undefined,
      user._id.toString(),
    );

    res
      .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
      .header('Authorization', accessToken)
      .send(user);
  }
  catch(err) {
    return res.status(500).json(err);
  }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.headers['id'] as string;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Logging
    Logger.log(
      LogEntities.USER,
      user._id.toString() ?? id,
      user.email,
      LogAction.LOGOUT,
      undefined,
      undefined,
      undefined,
      user._id.toString() ?? id,
    );

    res.clearCookie('refreshToken').send({ message: 'Logged out' });
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookies = getCookies(req);
    const refreshToken = cookies?.['refreshToken'];
    if (!refreshToken) {
      return res.status(401).send('Access Denied. No refresh token provided.');
    }

    const decoded = decodeToken(refreshToken);
    const accessToken = generateAccessToken(decoded.id);

    res.header('Authorization', accessToken).send((decoded as JwtPayload).id);
  } catch (error) {
    return res.status(400).send('Invalid refresh token.');
  }
}

const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.headers['id'] as string;
    const user = await User.findById(id);

    res.send(user);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.headers['id'] as string;
    const userChanges = req.body as Partial<IUser>;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(id, userChanges, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Logging
    Logger.logDifference(
      LogEntities.USER,
      updatedUser._id.toString() ?? id,
      updatedUser.email,
      LogAction.UPDATE,
      user,
      updatedUser,
      updatedUser._id.toString() ?? id,
    );

    res.send(updatedUser);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.headers['id'] as string;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid current password', code: 'INVALID_CURRENT_PASSWORD' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Logging
    Logger.log(
      LogEntities.USER,
      user._id.toString() ?? id,
      user.email,
      LogAction.UPDATE,
      'password',
      undefined,
      undefined,
      user._id.toString() ?? id,
    );

    res.send(user);
  }
  catch (err) {
    return res.status(500).json(err);
  }
}

export default { register, login, logout, refresh, getUser, updateUser, changePassword };
