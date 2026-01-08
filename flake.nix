{
  description = "Modern Go Application example";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        buildDeps = with pkgs; [ git go_1_25 ];
        devDeps = with pkgs; buildDeps ++ [
          golangci-lint
          gopls
          gotestsum
          goreleaser
        ];
      in
      { devShell = pkgs.mkShell { buildInputs = devDeps; }; });
}