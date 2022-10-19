/*
 * logout
 */

export default async (req, res) => {
  const { user } = req;
  const { t } = req.ttag;

  req.logout((err) => {
    if (err) {
      res.status(500);
      res.json({
        errors: [t`Server error when logging out.`],
      });
      return;
    }
    res.status(200);
    res.json({
      success: true,
    });
  });
};
