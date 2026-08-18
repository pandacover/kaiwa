"""Download Chatterbox Nano weights while building the container image."""

from kaiwa.tts import load_nano_model


def main() -> None:
    load_nano_model()
    print("Chatterbox Nano model cached in the image.")


if __name__ == "__main__":
    main()
