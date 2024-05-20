import { Request, Response, NextFunction } from 'express';
import User from '../models/user';
import bcrypt from 'bcrypt';
import Logger from './log';
import { generateTokens } from '../utils/generateTokens';
import { LogAction, LogEntities } from '../models/log';
import Organization, { IOrganization, OrganizationRole } from '../models/organization';

const registerOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { first_name, last_name, email, password, organization_name } = req.body;

    if (!first_name || !last_name || !email || !password || !organization_name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const userExists = await User.findOne({ email });
    if(userExists){
      return res.status(409).json({ message: 'Email already in use', code: 'EMAIL_IN_USE' });
    }

    // Create organization
    const organization = await Organization.create({
      name: organization_name,
      users: [],
    });

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
      is_active: true,
      is_organization_controlled: true,
      organizationId: organization._id,
    });

    const { accessToken, refreshToken } = generateTokens(String(user._id));
    Object.assign(user, { 
      access_token: accessToken,
      refresh_token: refreshToken
    });
    await user.save();

    const updatedOrg = await Organization.findByIdAndUpdate(organization._id, {
      $push: {
        users: {
          userId: user._id,
          role: 'OWNER',
          is_active: true,
        },
      },
    }, { new: true });
    if (!updatedOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Log organization create
    Logger.logCreate(
      LogEntities.ORGANIZATION,
      organization._id.toString(),
      organization.name,
      user._id.toString(),
    );

    // Log user create
    Logger.logCreate(
      LogEntities.USER,
      user._id.toString(),
      user.email,
      user._id.toString(),
    );

    // Log user add to org
    Logger.log(
      LogEntities.ORGANIZATION,
      updatedOrg._id.toString(),
      updatedOrg.name,
      LogAction.PUSHED,
      'users',
      undefined,
      user._id.toString(),
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

const getOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;

    const org = await Organization.findOne({ 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    res.send(org);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const getOrganizationUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.headers['id'] as string;
    const org = await Organization.findOne({ _id: orgId, 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const users = await User.find({ _id: { $in: org.users.map(u => u.userId) } } );
    if (!users) {
      return res.status(404).json({ message: 'No users found' });
    }

    res.send(users.map(user => ({
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      is_organization_controlled: user.is_organization_controlled,
      organizationId: user.organizationId,
      is_active: org.users.find(u => u.userId.toString() === user._id.toString())?.is_active,
      role: org.users.find(u => u.userId.toString() === user._id.toString())?.role,
    })));
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const orgId = req.params.orgId;
    const orgChanges = req.body as Partial<IOrganization>;

    const org = await Organization.findOne({ _id: orgId, 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const updatedOrg = await Organization.findByIdAndUpdate(orgId, orgChanges, { new: true });
    if (!updatedOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Logging
    Logger.logDifference(
      LogEntities.ORGANIZATION,
      updatedOrg._id.toString() ?? orgId,
      updatedOrg.name,
      LogAction.UPDATE,
      org,
      updatedOrg,
      userId,
    );

    res.send(updatedOrg);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const createOrganizationUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['id'] as string;
    const orgId = req.params.orgId;
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const org = await Organization.findById(orgId, { 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
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
      is_active: true,
      is_organization_controlled: true,
      organizationId: req.params.orgId,
    });

    const updatedOrg = await Organization.findByIdAndUpdate(orgId, {
      $push: {
        users: {
          userId: user._id,
          role: 'MEMBER',
          is_active: true,
        },
      },
    }, { new: true });
    if (!updatedOrg) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Logging user create
    Logger.logCreate(
      LogEntities.USER,
      user._id.toString(),
      user.email,
      userId,
    );

    // Logging organization update
    Logger.log(
      LogEntities.ORGANIZATION,
      updatedOrg._id.toString() ?? orgId,
      updatedOrg.name,
      LogAction.PUSHED,
      'users',
      undefined,
      user._id.toString(),
      userId,
    );

    res.send(updatedOrg);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const deleteOrganizationUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.params.orgId;
    const deletedUserId = req.params.userId as string;
    const userId = req.headers['id'] as string;

    const org = await Organization.findOne({ _id: orgId, 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const user = await User.findById(deletedUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedOrg = await Organization.findOneAndUpdate(
      { _id: orgId, 'users.userId': deletedUserId },
      { $set: { 'users.$.is_active': false } },
      { new: true }
    );
    if (!updatedOrg) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(deletedUserId, { is_active: false }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Logging user change
    Logger.logDifference(
      LogEntities.USER,
      updatedUser._id.toString() ?? orgId,
      updatedUser.email,
      LogAction.UPDATE,
      user,
      updatedUser,
      userId,
    );

    // Logging organization change
    Logger.log(
      LogEntities.ORGANIZATION,
      updatedOrg._id.toString(),
      updatedOrg.name,
      LogAction.PULLED,
      'users',
      deletedUserId.toString(),
      undefined,
      userId,
    );

    res.send(updatedOrg);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

const updateOrganizationUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.params.orgId;
    const updatedUserId = req.params.userId as string;
    const userId = req.headers['id'] as string;
    const role = req.body.role as OrganizationRole;

    const org = await Organization.findOne({ _id: orgId, 'users.userId': userId });
    if (!org) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updatedOrg = await Organization.findOneAndUpdate(
      { _id: orgId, 'users.userId': updatedUserId },
      { $set: { 'users.$.role': role } },
      { new: true }
    );

    if (!updatedOrg) {
      return res.status(404).json({ message: 'User not in organization', code: 'USER_NOT_IN_ORGANIZATION' });
    }

    // Logging
    Logger.log(
      LogEntities.ORGANIZATION,
      updatedOrg._id.toString(),
      updatedOrg.name,
      LogAction.UPDATE,
      'users',
      JSON.stringify(org.users.find(u => u.userId.toString() === updatedUserId)),
      JSON.stringify(updatedOrg.users.find(u =>  u.userId.toString()=== updatedUserId)),
      userId
    );

    res.send(updatedOrg);
  }
  catch (err) {
    return res.status(500).json(err);
  }
};

export default {
  registerOrganization,
  getOrganization,
  getOrganizationUsers,
  updateOrganization,
  createOrganizationUser,
  updateOrganizationUserRole,
  deleteOrganizationUser,
};
