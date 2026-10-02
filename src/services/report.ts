import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Child, Note, Session } from '../types';
import { buildReportHtml } from './reportHtml';

/** Renders the report to a PDF on the device and opens the share sheet. */
export async function shareReport(child: Child, sessions: Session[], notes: Note[]) {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(child, sessions, notes) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${child.name} progress report` });
  }
}
