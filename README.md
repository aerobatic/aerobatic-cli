# aerobatic-cli

Command line interface for interacting with the [Aerobatic](https://www.aerobatic.com) static hosting platform.

### Installation

```sh
npm install aerobatic-cli -g
```

This will make the `aero` command globally available. Run `aero help` for usage instructions:

```sh
Aerobatic - Professional static web publishing. (v1.0.7)

Usage:
    $ aero [command] [options]

Commands:
    account        Display a summary of the current Aerobatic account.
    apikey         Get the api key for the current Aerobatic account.
    create         Create a new Aerobatic website in the current directory
    delete         Delete the current website
    deploy         Deploy the website in the current directory.
    domain         Register a custom domain for the current website
    env            Set or retrieve environment variables
    info           Display a summary of the current website
    login          Login to your Aerobatic account
    logs           Tail the web logs for the current website
    register       Register a new Aerobatic account
    rename         Rename the website
    switch         Switch to a different Aerobatic account
    versions       Manage website versions

    Type aero help COMMAND for more details
```

Complete docs available at: [https://www.aerobatic.com/docs/cli](https://www.aerobatic.com/docs/cli)
