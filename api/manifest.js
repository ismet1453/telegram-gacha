module.exports = (req, res) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`.replace(/\/$/, '');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        url: origin,
        name: 'Gacha Cup',
        iconUrl: `${origin}/logo.png`,
        termsOfUseUrl: 'https://t.me/FootballGacha',
        privacyPolicyUrl: 'https://t.me/FootballGacha'
    });
};
