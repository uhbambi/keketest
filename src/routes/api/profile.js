/*
 * get profile information of user
 */
import { getFishesOfUser } from '../../data/sql/Fish.js';

export default async (req, res) => {
  const { user } = req;
  if (!user || !user.id) {
    res.status(400).json({ errors: ['You are not logged in'] });
    return;
  }
  const fishes = await getFishesOfUser(user.id);
  res.status(200).json({ fishes });
};
