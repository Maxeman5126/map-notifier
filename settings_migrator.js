const DefaultSettings = {
        "whitelist": {
            "206858": "Go to Tulufan then head south to the three trees.",
            "206859": "Go to Frontera then head north into the cave.",
            "206860": "Go to Bastion. Local TP to Channelworks. Jump east off the bridge.",
            "206861": "Go to Acarum. Local TP to Gloomhaunt Sentry Post",
            "206862": "Go to Pathfinder Post. Local TP to Field Base Valiance. go southwest to a floating platform staircase. Go in the cave to the blue coils."
        },
        "enabled": true,
        "notifyParty": true,
        "tips": true,
        "markers": true,
        "markerItem": "88704"
    }

module.exports = function MigrateSettings(from_ver, to_ver, settings) {
    if (from_ver === undefined) {
        // Migrate legacy config file
        return Object.assign(Object.assign({}, DefaultSettings), settings);
    } else if (from_ver === null) {
        // No config file exists, use default settings
        return DefaultSettings;
    } else {
        // Migrate from older version (using the new system) to latest one
        if (from_ver + 1 < to_ver) {
            // Recursively upgrade in one-version steps
            settings = MigrateSettings(from_ver, from_ver + 1, settings);
            return MigrateSettings(from_ver + 1, to_ver, settings);
        }

        // If we reach this point it's guaranteed that from_ver === to_ver - 1, so we can implement
        // a switch for each version step that upgrades to the next version. This enables us to
        // upgrade from any version to the latest version without additional effort!
        switch (to_ver) {
            case 2:
                break;
        }

        return settings;
    }
}
