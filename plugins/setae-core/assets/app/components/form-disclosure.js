export function revealFormControl(control) {
  let disclosure = control?.closest?.('details');
  while (disclosure) {
    disclosure.open = true;
    disclosure = disclosure.parentElement?.closest?.('details');
  }
}
